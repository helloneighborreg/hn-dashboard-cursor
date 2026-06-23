export function compareValues(a, b, { numeric = false } = {}) {
	if (numeric) {
		return (Number(a) || 0) - (Number(b) || 0);
	}
	return String(a ?? '').localeCompare(String(b ?? ''), undefined, {
		numeric: true,
		sensitivity: 'base',
	});
}

export function sortByKey(items, sortKey, sortDir, getValue, { numericKeys = new Set() } = {}) {
	if (!sortKey || !items?.length) return items;
	const factor = sortDir === 'desc' ? -1 : 1;
	const numeric = numericKeys.has(sortKey);

	return [...items].sort((a, b) => {
		const av = getValue(a, sortKey);
		const bv = getValue(b, sortKey);
		return factor * compareValues(av, bv, { numeric });
	});
}
