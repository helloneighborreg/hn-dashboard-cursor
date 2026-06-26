import { listDashboardCleaners, withAuth } from '../../../../lib/auth';
import { isAdmin } from '../../../../lib/roles';
import { getPropertyDetails, upsertPropertyDetails } from '../../../../lib/db';
import { toIsoDate } from '../../../../lib/dates';
import { getGuestCheckoutUrl, isValidCheckoutCode, normalizeCheckoutCode } from '../../../../lib/guestCheckout';
import { ensurePropertyCheckoutCode } from '../../../../lib/guestCheckoutDb';
import { getPropertyBackupImagePublicUrl } from '../../../../lib/propertyDetailsStorage';
import { rejectHiddenProperty } from '../../../../lib/hiddenProperties';
import {
	diffRecordChanges,
	inferDetailsSection,
	logPropertyChange,
} from '../../../../lib/propertyChangeLog';

function parseOptionalAmount(value) {
	if (value === '' || value == null) return null;
	const n = Number(value);
	if (!Number.isFinite(n) || n < 0) {
		throw new Error('Amount must be a non-negative number.');
	}
	return Math.round(n * 100) / 100;
}

function parseOptionalInt(value, label) {
	if (value === '' || value == null) return null;
	const n = Number(value);
	if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
		throw new Error(`${label} must be a whole number.`);
	}
	return n;
}

function parseOptionalDate(value) {
	if (!value) return null;
	return toIsoDate(value) || null;
}

function normalizeDetailsPatch(body = {}) {
	const patch = {};
	if ('rent' in body) patch.rent = parseOptionalAmount(body.rent);
	if ('lease_utilities' in body) patch.lease_utilities = parseOptionalAmount(body.lease_utilities);
	if ('lease_electric' in body) patch.lease_electric = parseOptionalAmount(body.lease_electric);
	if ('lease_internet' in body) patch.lease_internet = parseOptionalAmount(body.lease_internet);
	if ('lease_parking' in body) patch.lease_parking = parseOptionalAmount(body.lease_parking);
	if ('lease_expiration' in body) patch.lease_expiration = parseOptionalDate(body.lease_expiration);
	if ('renewal_notice_due' in body) patch.renewal_notice_due = parseOptionalDate(body.renewal_notice_due);
	if ('square_feet' in body) patch.square_feet = parseOptionalInt(body.square_feet, 'Square feet');
	if ('year_built' in body) patch.year_built = parseOptionalInt(body.year_built, 'Year built');
	if ('mailbox' in body) patch.mailbox = String(body.mailbox ?? '').trim();
	if ('parking_number' in body) patch.parking_number = String(body.parking_number ?? '').trim();
	if ('parking_code' in body) patch.parking_code = String(body.parking_code ?? '').trim();
	if ('backup_lockbox_location' in body) patch.backup_lockbox_location = String(body.backup_lockbox_location ?? '').trim();
	if ('backup_lockbox_code' in body) patch.backup_lockbox_code = String(body.backup_lockbox_code ?? '').trim();
	if ('backup_date_confirmed' in body) patch.backup_date_confirmed = parseOptionalDate(body.backup_date_confirmed);
	if ('base_cleaning_rate' in body) patch.base_cleaning_rate = parseOptionalAmount(body.base_cleaning_rate);
	if ('backup_image_storage_path' in body) {
		patch.backup_image_storage_path = String(body.backup_image_storage_path ?? '').trim() || null;
	}
	if ('utilities_provider' in body) patch.utilities_provider = String(body.utilities_provider ?? '').trim();
	if ('utilities_account_number' in body) patch.utilities_account_number = String(body.utilities_account_number ?? '').trim();
	if ('internet_provider' in body) patch.internet_provider = String(body.internet_provider ?? '').trim();
	if ('internet_account_number' in body) patch.internet_account_number = String(body.internet_account_number ?? '').trim();
	if ('primary_cleaner' in body) patch.primary_cleaner = String(body.primary_cleaner ?? '').trim();
	if ('checkout_code' in body) {
		const raw = String(body.checkout_code ?? '').trim().toUpperCase();
		if (!raw) {
			patch.checkout_code = '';
		} else {
			const normalized = normalizeCheckoutCode(raw);
			if (!normalized || !isValidCheckoutCode(normalized)) {
				throw new Error('Checkout code must be 3 digits + 3 letters (e.g. 123ABC).');
			}
			patch.checkout_code = normalized;
		}
	}
	return patch;
}

function enrichDetails(row, propertyId) {
	if (!row) return { property_id: propertyId || null };
	const checkout_code = row.checkout_code || null;
	return {
		...row,
		backup_image_url: getPropertyBackupImagePublicUrl(row.backup_image_storage_path),
		checkout_code,
		checkout_url: checkout_code ? getGuestCheckoutUrl(checkout_code) : null,
	};
}

export default async function handler(req, res) {
	await withAuth(req, res, async (session) => {
		const { id: propertyId } = req.query;
		if (!propertyId) return res.status(400).json({ error: 'Property id is required.' });
		if (rejectHiddenProperty(propertyId, res)) return;

		if (req.method === 'GET') {
			let details = await getPropertyDetails(propertyId);
			if (isAdmin(session.user)) {
				try {
					const code = await ensurePropertyCheckoutCode(propertyId);
					if (!details?.checkout_code) {
						details = { ...(details || {}), property_id: propertyId, checkout_code: code };
					}
				} catch (err) {
					console.error('Property checkout code ensure failed:', propertyId, err.message);
				}
			}
			return res.json({
				data: enrichDetails(details || { property_id: propertyId }, propertyId),
				cleaners: listDashboardCleaners(),
			});
		}

		if (req.method === 'PUT' || req.method === 'PATCH') {
			if (!isAdmin(session.user)) {
				return res.status(403).json({ error: 'Forbidden' });
			}
			try {
				const body = req.body || {};
				const section = typeof body.section === 'string' ? body.section.trim() : '';
				const patch = normalizeDetailsPatch(body);
				if (!Object.keys(patch).length) {
					return res.status(400).json({ error: 'No fields to update.' });
				}
				const previous = await getPropertyDetails(propertyId);
				const details = await upsertPropertyDetails(propertyId, patch);
				const changes = diffRecordChanges(previous, patch);
				await logPropertyChange({
					propertyId,
					section: inferDetailsSection(patch, section),
					resource: 'details',
					changes,
					user: session.user,
				});
				return res.json({ data: enrichDetails(details, propertyId) });
			} catch (err) {
				return res.status(400).json({ error: err.message || 'Invalid property details.' });
			}
		}

		return res.status(405).end();
	});
}
