const CASCADES_RE = /^Cascades\s*\|\s*(\d+)/i;
const KIRKWOOD_RE = /^Kirkwood\s*\|\s*(\d+)/i;
const SHORT_CODE_RE = /^(CJC|KWD)\d+$/i;

/** Full Hospitable property label (e.g. Cascades | 9206 | Maddox). */
export function getPropertyDisplayName(property) {
	const raw = property?.name?.trim() || property?.public_name?.trim();
	return raw || null;
}

/** Map CJC9206 / KWD502 → full property name from Hospitable property list. */
export function buildPropertyCodeToNameMap(properties) {
	const map = {};
	for (const property of properties || []) {
		const code = getPropertyCode(property);
		const name = getPropertyDisplayName(property);
		if (code && name) map[code.toUpperCase()] = name;
	}
	return map;
}

/**
 * Display name for UI — keeps pipe-formatted names; resolves short codes via lookup map.
 */
export function formatPropertyDisplayName(nameOrCode, codeToNameMap = {}) {
	const raw = String(nameOrCode || '').trim();
	if (!raw) return '';

	if (raw.includes('|')) return raw;

	const code = resolvePropertyCode(raw);
	if (code && codeToNameMap[code.toUpperCase()]) {
		return codeToNameMap[code.toUpperCase()];
	}

	if (SHORT_CODE_RE.test(raw.toUpperCase())) {
		return codeToNameMap[raw.toUpperCase()] || raw;
	}

	return raw;
}

/** Short property code (e.g. CJC8303, KWD502) from Hospitable property fields. */
export function getPropertyCode(property) {
	const raw = property?.name?.trim() || property?.public_name?.trim();
	if (!raw) return null;
	return resolvePropertyCode(raw);
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

/** Normalize property_name on API rows (expenses, financials, etc.). */
export function formatPropertyNameForRow(row, codeToNameMap = {}, propMap = {}) {
	if (!row) return row;
	const fromId = row.property_id && propMap[row.property_id]
		? getPropertyDisplayName(propMap[row.property_id])
		: '';
	const property_name = formatPropertyDisplayName(row.property_name || fromId, codeToNameMap)
		|| fromId
		|| row.property_name
		|| '';
	if (property_name === row.property_name) return row;
	return { ...row, property_name };
}
