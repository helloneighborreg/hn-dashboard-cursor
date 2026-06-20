/** Apply single- or multi-property filter to a Supabase query builder. */
export function applyPropertyIdFilter(query, filters = {}) {
	const ids = filters.property_ids?.length
		? filters.property_ids
		: filters.property_id
			? [filters.property_id]
			: null;

	if (!ids?.length) return query;
	if (ids.length === 1) return query.eq('property_id', ids[0]);
	return query.in('property_id', ids);
}
