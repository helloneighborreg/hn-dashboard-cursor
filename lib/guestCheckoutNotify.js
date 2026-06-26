import { getAssigneeContact } from './auth';
import { getPropertyDetails } from './db';
import { formatDateShort } from './taskDisplay';
import { markGuestCheckoutCleanerNotified, resolveTurnoverTaskForGuestCheckout } from './guestCheckoutDb';
import { sendEmail } from './notify';

function escapeHtml(value) {
	return String(value || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

async function resolveCleanerName(checkout, task) {
	if (checkout?.property_id) {
		const details = await getPropertyDetails(checkout.property_id);
		const primary = details?.primary_cleaner?.trim();
		if (primary) return primary;
	}
	return task?.assignee?.trim() || null;
}

function checkoutMessage(checkout, task, cleanerName) {
	const property = checkout.property_name || task?.property_name || '—';
	const guest = checkout.guest_name || task?.guest_name || task?.description || '—';
	const checkoutDate = formatDateShort(checkout.checkout_date || task?.checkout_date || task?.due_date);
	const lines = [
		'Hello Neighbor — guest checked out',
		'',
		`Property: ${property}`,
		`Guest: ${guest}`,
		`Checkout date: ${checkoutDate}`,
	];

	if (cleanerName) {
		lines.push('', `Primary cleaner: ${cleanerName}`);
	}

	lines.push('', 'The guest confirmed checkout. You can begin cleaning when ready.');

	return lines.join('\n');
}

function checkoutMessageHtml(checkout, task, cleanerName) {
	const property = checkout.property_name || task?.property_name || '—';
	const guest = checkout.guest_name || task?.guest_name || task?.description || '—';
	const checkoutDate = formatDateShort(checkout.checkout_date || task?.checkout_date || task?.due_date);

	const blocks = [
		'<p>Hello Neighbor — guest checked out</p>',
		`<p><strong>${escapeHtml(property)}</strong></p>`,
		`<p>Guest: ${escapeHtml(guest)}</p>`,
		`<p>Checkout date: ${escapeHtml(checkoutDate)}</p>`,
	];

	if (cleanerName) {
		blocks.push(`<p>Primary cleaner: ${escapeHtml(cleanerName)}</p>`);
	}

	blocks.push('<p>The guest confirmed checkout. You can begin cleaning when ready.</p>');
	return blocks.join('\n');
}

/**
 * Email the property's primary cleaner (or task assignee) when a guest confirms checkout.
 */
export async function notifyGuestCheckoutConfirmed(checkout) {
	if (!checkout?.id || checkout.notified_cleaner_at) {
		return { emailed: false, skipped: true, reason: 'already_notified' };
	}

	let task = await resolveTurnoverTaskForGuestCheckout(checkout);
	const cleanerName = await resolveCleanerName(checkout, task);
	if (!cleanerName) {
		console.warn('Guest checkout notify: no primary cleaner or assignee for property', checkout.property_id);
		return { emailed: false, skipped: true, reason: 'no_cleaner' };
	}

	const contact = getAssigneeContact(cleanerName);
	if (!contact?.email) {
		console.warn(`Guest checkout notify: no email for cleaner "${cleanerName}"`);
		return { emailed: false, skipped: true, reason: 'no_contact' };
	}

	const property = checkout.property_name || task?.property_name || 'Property';
	const subject = `Guest checked out: ${property}`;
	const emailed = await sendEmail(contact.email, subject, {
		text: checkoutMessage(checkout, task, cleanerName),
		html: checkoutMessageHtml(checkout, task, cleanerName),
	});

	if (emailed) {
		await markGuestCheckoutCleanerNotified(checkout.id);
	}

	return {
		emailed,
		skipped: !emailed,
		reason: emailed ? null : 'delivery_failed',
		cleaner: cleanerName,
	};
}
