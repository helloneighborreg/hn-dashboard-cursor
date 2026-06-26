import { getSupabase } from './supabase.js';
import { getTaskById, getPropertyDetails, upsertPropertyDetails } from './db.js';
import {
	generateCheckoutCode,
	isValidCheckoutCode,
	normalizeCheckoutCode,
} from './guestCheckout.js';
import { getProperty, getPropertyDisplayName, getPropertyFullName } from './hospitable.js';
import { isHiddenPropertyId } from './hiddenProperties.js';
import { todayIso } from './dates.js';

function throwDbError(error) {
	throw error;
}

function now() {
	return new Date().toISOString();
}

async function findTurnoverTaskForPropertyCheckout(propertyId, checkoutDate) {
	if (!propertyId || !checkoutDate) return null;

	const supabase = getSupabase();
	const { data: rows, error } = await supabase
		.from('tasks')
		.select('*')
		.eq('property_id', propertyId)
		.eq('checkout_date', checkoutDate)
		.eq('type', 'turnover')
		.order('updated_at', { ascending: false });
	if (error) throwDbError(error);
	if (!rows?.length) return null;
	if (rows.length === 1) return rows[0];

	const active = rows.filter((row) => row.status !== 'completed');
	return active[0] || rows[0];
}

async function resolvePropertyName(propertyId) {
	try {
		const property = await getProperty(propertyId);
		return getPropertyFullName(property) || getPropertyDisplayName(property) || propertyId;
	} catch {
		return propertyId;
	}
}

export async function getPropertyByCheckoutCode(code) {
	const normalized = normalizeCheckoutCode(code);
	if (!normalized) return null;

	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('property_details')
		.select('property_id, checkout_code')
		.eq('checkout_code', normalized)
		.maybeSingle();
	if (error) throwDbError(error);
	return data;
}

/** Ensure a property has a unique checkout code; returns the code string. */
export async function ensurePropertyCheckoutCode(propertyId) {
	if (!propertyId) return null;

	const details = await getPropertyDetails(propertyId);
	if (details?.checkout_code) return details.checkout_code;

	for (let attempt = 0; attempt < 12; attempt += 1) {
		const code = generateCheckoutCode();
		try {
			await upsertPropertyDetails(propertyId, { checkout_code: code });
			return code;
		} catch (err) {
			if (err?.code === '23505' && /checkout_code/i.test(err?.message || '')) continue;
			throw err;
		}
	}

	throw new Error('Could not generate a unique property checkout code.');
}

async function resolveCheckoutContextForProperty(propertyId, checkoutDate = todayIso()) {
	const task = await findTurnoverTaskForPropertyCheckout(propertyId, checkoutDate);
	const existing = await getGuestCheckoutByPropertyDate(propertyId, checkoutDate);
	const property_name = await resolvePropertyName(propertyId);

	return {
		property_id: propertyId,
		checkout_date: checkoutDate,
		property_name,
		task,
		existing,
	};
}

/** Active turnover task for a property on a checkout date (for notifications). */
export async function resolveTurnoverTaskForGuestCheckout(checkout) {
	if (checkout?.task_id) {
		const linked = await getTaskById(checkout.task_id);
		if (linked) return linked;
	}
	if (!checkout?.property_id || !checkout?.checkout_date) return null;
	return findTurnoverTaskForPropertyCheckout(checkout.property_id, checkout.checkout_date);
}

export async function getGuestCheckoutByCode(code) {
	const property = await getPropertyByCheckoutCode(code);
	if (!property || isHiddenPropertyId(property.property_id)) return null;

	const context = await resolveCheckoutContextForProperty(property.property_id);
	const base = context.existing || {
		property_id: property.property_id,
		checkout_date: context.checkout_date,
		property_name: context.property_name,
		task_id: context.task?.id || null,
		guest_name: context.task?.guest_name?.trim() || context.task?.description?.trim() || null,
		reservation_id: context.task?.reservation_id || null,
		confirmed_at: null,
	};
	return { ...base, property_name: context.property_name };
}

export async function getGuestCheckoutByPropertyDate(propertyId, checkoutDate) {
	if (!propertyId || !checkoutDate) return null;

	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('guest_checkouts')
		.select('*')
		.eq('property_id', propertyId)
		.eq('checkout_date', checkoutDate)
		.maybeSingle();
	if (error) throwDbError(error);
	return data;
}

async function insertGuestCheckout(record) {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('guest_checkouts')
		.insert({
			...record,
			created_at: now(),
			updated_at: now(),
		})
		.select()
		.single();
	if (error) throwDbError(error);
	return data;
}

async function updateGuestCheckout(id, patch) {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('guest_checkouts')
		.update({ ...patch, updated_at: now() })
		.eq('id', id)
		.select()
		.single();
	if (error) throwDbError(error);
	return data;
}

async function refreshCheckoutTaskLink(checkout) {
	if (!checkout?.property_id || !checkout?.checkout_date) return checkout;

	const task = await findTurnoverTaskForPropertyCheckout(
		checkout.property_id,
		checkout.checkout_date,
	);
	if (!task) return checkout;

	const patch = {
		task_id: task.id,
		reservation_id: task.reservation_id || checkout.reservation_id,
		property_name: (await resolvePropertyName(checkout.property_id)) || task.property_name?.trim() || checkout.property_name,
		guest_name: task.guest_name?.trim() || task.description?.trim() || checkout.guest_name,
	};
	const changed = Object.entries(patch).some(([key, value]) => checkout[key] !== value);
	if (!changed) return checkout;

	return updateGuestCheckout(checkout.id, patch);
}

async function ensureCheckoutConfirmationRecord(propertyId, checkoutDate, meta = {}) {
	const existing = await getGuestCheckoutByPropertyDate(propertyId, checkoutDate);
	if (existing) return existing;

	try {
		return await insertGuestCheckout({
			property_id: propertyId,
			checkout_date: checkoutDate,
			...meta,
		});
	} catch (err) {
		if (err?.code === '23505' && /guest_checkouts_property_date_unique/i.test(err?.message || '')) {
			return getGuestCheckoutByPropertyDate(propertyId, checkoutDate);
		}
		throw err;
	}
}

export async function confirmGuestCheckout(code, { enjoyed_stay = null, rating = null, feedback = null } = {}) {
	const normalized = normalizeCheckoutCode(code);
	if (!isValidCheckoutCode(normalized)) {
		const err = new Error('Enter a valid checkout code (3 digits + 3 letters, e.g. 123ABC).');
		err.status = 400;
		throw err;
	}

	const property = await getPropertyByCheckoutCode(normalized);
	if (!property || isHiddenPropertyId(property.property_id)) {
		const err = new Error('That checkout code was not found. Please check the code in your instructions and try again.');
		err.status = 404;
		throw err;
	}

	const context = await resolveCheckoutContextForProperty(property.property_id);
	let existing = context.existing;

	if (existing?.confirmed_at) {
		const err = new Error('This checkout has already been confirmed.');
		err.status = 409;
		err.checkout = existing;
		throw err;
	}

	let parsedRating = null;
	if (rating !== null && rating !== undefined && rating !== '') {
		const n = Number(rating);
		if (!Number.isInteger(n) || n < 1 || n > 5) {
			const err = new Error('Rating must be between 1 and 5 stars.');
			err.status = 400;
			throw err;
		}
		parsedRating = n;
	}

	let enjoyed = null;
	if (enjoyed_stay === true || enjoyed_stay === false) {
		enjoyed = enjoyed_stay;
	} else if (enjoyed_stay === 'yes') {
		enjoyed = true;
	} else if (enjoyed_stay === 'no') {
		enjoyed = false;
	}

	const feedbackText = typeof feedback === 'string' ? feedback.trim().slice(0, 2000) : null;

	if (!existing) {
		existing = await ensureCheckoutConfirmationRecord(property.property_id, context.checkout_date, {
			task_id: context.task?.id || null,
			reservation_id: context.task?.reservation_id || null,
			property_name: context.property_name,
			guest_name: context.task?.guest_name?.trim() || context.task?.description?.trim() || null,
		});
	}

	let confirmed = await updateGuestCheckout(existing.id, {
		confirmed_at: now(),
		enjoyed_stay: enjoyed,
		rating: parsedRating,
		feedback: feedbackText || null,
	});

	confirmed = await refreshCheckoutTaskLink(confirmed);
	return confirmed;
}

export async function markGuestCheckoutCleanerNotified(id) {
	return updateGuestCheckout(id, { notified_cleaner_at: now() });
}
