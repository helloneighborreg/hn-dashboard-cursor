const CASCADES_RE = /^Cascades\s*\|\s*(\d+)/i;
const KIRKWOOD_RE = /^Kirkwood\s*\|\s*(\d+)/i;

/** Short property code (e.g. CJC8303, KWD502) from Hospitable `name`. */
export function getPropertyCode(property) {
	return property?.name?.trim() || null;
}

/**
 * Normalize a Hospitable property name or short code to CJC8303 / KWD502 style.
 * e.g. "Cascades | 8303 | Baker" → CJC8303, "Kirkwood | 502 | Judson" → KWD502
 */
export function resolvePropertyCode(nameOrCode) {
	const raw = String(nameOrCode || '').trim();
	if (!raw) return null;

	const upper = raw.toUpperCase();
	if (/^CJC\d+$/.test(upper)) return upper;
	if (/^KWD\d+$/.test(upper)) return upper;

	const cascades = CASCADES_RE.exec(raw);
	if (cascades) return `CJC${cascades[1]}`;

	const kirkwood = KIRKWOOD_RE.exec(raw);
	if (kirkwood) return `KWD${kirkwood[1]}`;

	return raw;
}

/** Human reservation code (e.g. HZCQWSDFA) from Hospitable `code`. */
export function getReservationCode(reservation) {
	return reservation?.code?.trim() || null;
}
