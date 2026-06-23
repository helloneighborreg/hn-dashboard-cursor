import { getPropertyCode, resolvePropertyCode } from './codes';
import { getPropertyDetails } from './db';
import { getProperties } from './hospitable';

export function normalizeBaseCleaningRate(value) {
	if (value == null || value === '') return 0;
	const n = Number(value);
	if (!Number.isFinite(n) || n < 0) return 0;
	return Math.round(n * 100) / 100;
}

/** Lookup base cleaning rate from property_details by short code (e.g. CJC8103). */
export async function getBaseCleaningRateForPropertyCode(propertyCode) {
	const code = resolvePropertyCode(propertyCode);
	if (!code) return 0;

	try {
		const properties = await getProperties();
		const match = properties.find((property) => {
			const propertyCodeValue = getPropertyCode(property);
			return propertyCodeValue && propertyCodeValue.toUpperCase() === code.toUpperCase();
		});
		if (!match?.id) return 0;

		const details = await getPropertyDetails(match.id);
		return normalizeBaseCleaningRate(details?.base_cleaning_rate);
	} catch (err) {
		console.warn('Base cleaning rate lookup failed:', err.message);
		return 0;
	}
}
