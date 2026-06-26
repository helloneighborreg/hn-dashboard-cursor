/** Properties no longer managed — excluded from lists, sync, and direct access. */
export const HIDDEN_PROPERTY_IDS = new Set([
	'6afeb65a-8a9b-4afb-97f7-de9157abc65b', // East Village Loft | Lincoln
]);

const HIDDEN_NAME_PATTERNS = [/east village loft/i];

export function isHiddenPropertyId(propertyId) {
	return Boolean(propertyId && HIDDEN_PROPERTY_IDS.has(propertyId));
}

export function isHiddenProperty(property) {
	if (!property) return false;
	if (property.id && HIDDEN_PROPERTY_IDS.has(property.id)) return true;
	const name = `${property.name || ''} ${property.public_name || ''}`;
	return HIDDEN_NAME_PATTERNS.some((re) => re.test(name));
}

export function filterVisibleProperties(properties) {
	return (properties || []).filter((p) => !isHiddenProperty(p));
}

export function filterHiddenPropertyRows(rows, key = 'property_id') {
	return (rows || []).filter((row) => !isHiddenPropertyId(row?.[key]));
}

/** Respond 404 when propertyId is hidden; returns true if the request was handled. */
export function rejectHiddenProperty(propertyId, res) {
	if (!isHiddenPropertyId(propertyId)) return false;
	res.status(404).json({ error: 'Property not found' });
	return true;
}
