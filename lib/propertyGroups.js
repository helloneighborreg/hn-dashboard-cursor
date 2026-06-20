import { getPropertyCode } from './codes';

const GROUP_RULES = [
	{
		id: 'cascades',
		label: 'Cascades',
		match: (property) => {
			const code = getPropertyCode(property);
			if (code?.toUpperCase().startsWith('CJC')) return true;
			return /cascades/i.test(property?.name || property?.public_name || '');
		},
	},
	{
		id: 'kirkwood',
		label: 'Kirkwood',
		match: (property) => {
			const code = getPropertyCode(property);
			if (code?.toUpperCase().startsWith('KWD')) return true;
			return /kirkwood/i.test(property?.name || property?.public_name || '');
		},
	},
];

/** Build property groups from the live Hospitable property list. */
export function buildPropertyGroups(properties = []) {
	const groups = GROUP_RULES.map((rule) => ({
		id: rule.id,
		label: rule.label,
		propertyIds: properties.filter(rule.match).map((p) => p.id),
	})).filter((g) => g.propertyIds.length > 0);

	const assigned = new Set(groups.flatMap((g) => g.propertyIds));
	const otherIds = properties.filter((p) => !assigned.has(p.id)).map((p) => p.id);
	if (otherIds.length) {
		groups.push({ id: 'other', label: 'Other', propertyIds: otherIds });
	}

	return groups;
}

export function groupForProperty(property, groups) {
	return groups.find((g) => g.propertyIds.includes(property.id)) || null;
}

/**
 * Resolve selected property IDs from report filter state.
 * @returns {string[]|null} null = all properties
 */
export function resolvePropertyIds(properties, filters = {}) {
	const allIds = (properties || []).map((p) => p.id);
	if (!allIds.length) return null;

	const mode = filters.property_mode || 'all';
	if (mode === 'all') return null;

	if (mode === 'one') {
		const id = filters.property?.trim();
		return id ? [id] : null;
	}

	if (mode === 'group') {
		const groups = buildPropertyGroups(properties);
		const group = groups.find((g) => g.id === filters.property_group);
		return group?.propertyIds?.length ? group.propertyIds : null;
	}

	if (mode === 'custom') {
		const ids = (filters.property_ids || []).filter((id) => allIds.includes(id));
		return ids;
	}

	return null;
}

export function propertyScopeLabel(properties, propertyIds) {
	if (propertyIds == null) return 'All Properties';
	if (propertyIds.length === 1) {
		const prop = properties.find((p) => p.id === propertyIds[0]);
		return prop?.name || prop?.public_name || '1 Property';
	}
	return `${propertyIds.length} Properties`;
}

export function propertyFilterSummary(properties, filters = {}) {
	const mode = filters.property_mode || 'all';
	if (mode === 'all') return 'All properties';

	const ids = resolvePropertyIds(properties, filters);
	if (!ids?.length) return 'All properties';

	if (mode === 'one') {
		const prop = properties.find((p) => p.id === ids[0]);
		return prop?.name || prop?.public_name || '1 property';
	}

	if (mode === 'group') {
		const groups = buildPropertyGroups(properties);
		const group = groups.find((g) => g.id === filters.property_group);
		return group?.label || `${ids.length} properties`;
	}

	if (ids.length === 1) {
		const prop = properties.find((p) => p.id === ids[0]);
		return prop?.name || prop?.public_name || '1 property';
	}

	return `${ids.length} properties`;
}

/** Parse `properties` query param (comma-separated UUIDs). */
export function parsePropertyIdsQuery(value) {
	if (!value) return null;
	const ids = String(value)
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	return ids.length ? ids : null;
}
