import { todayIso } from './dates';

const CODE_RE = /^\d{3}[A-Z]{3}$/;

/** Fixed code for admins to exercise the live guest checkout flow (no DB writes). */
export const ADMIN_TEST_CHECKOUT_CODE = '522ABC';

/** Public guest checkout page URL (optional code query prefill). */
export function getGuestCheckoutUrl(code = null) {
	const base = (process.env.GUEST_CHECKOUT_BASE_URL || '').trim().replace(/\/$/, '');
	const path = '/guest/checkout';
	const origin = base || '';
	const url = origin ? `${origin}${path}` : path;
	if (!code) return url;
	const normalized = normalizeCheckoutCode(code);
	return normalized ? `${url}?code=${normalized}` : url;
}

/** Normalize to 3 digits + 3 uppercase letters (e.g. 123ABC). */
export function normalizeCheckoutCode(value) {
	const raw = String(value || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
	if (raw.length !== 6) return null;
	if (!CODE_RE.test(raw)) return null;
	return raw;
}

export function isValidCheckoutCode(value) {
	return CODE_RE.test(String(value || '').toUpperCase());
}

export function isAdminTestCheckoutCode(value) {
	return normalizeCheckoutCode(value) === ADMIN_TEST_CHECKOUT_CODE;
}

/** Synthetic stay used only for ADMIN_TEST_CHECKOUT_CODE lookups/confirms. */
export function adminTestCheckoutRecord({ confirmed = false } = {}) {
	return {
		property_name: 'Demo Property (Admin Test)',
		checkout_date: todayIso(),
		confirmed_at: confirmed ? new Date().toISOString() : null,
	};
}

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateCheckoutCode() {
	for (let attempt = 0; attempt < 20; attempt += 1) {
		const digits = String(Math.floor(100 + Math.random() * 900));
		let letters = '';
		for (let i = 0; i < 3; i += 1) {
			letters += LETTERS[Math.floor(Math.random() * LETTERS.length)];
		}
		const code = `${digits}${letters}`;
		if (!isAdminTestCheckoutCode(code)) return code;
	}
	throw new Error('Could not generate a unique guest checkout code.');
}

/** Minimal public payload — no guest PII beyond property confirmation. */
export function publicCheckoutPayload(row, { property_image_url = null } = {}) {
	if (!row) return null;
	return {
		property_name: row.property_name,
		checkout_date: row.checkout_date || null,
		property_image_url: property_image_url || null,
		already_confirmed: Boolean(row.confirmed_at),
	};
}
