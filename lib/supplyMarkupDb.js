import { getSupabase } from './supabase.js';
import { DEFAULT_SUPPLY_MARKUP_PERCENT, parseMarkupPercent, SUPPLY_MARKUP_SETTINGS_KEY } from './supplies.js';

const CACHE_MS = 30_000;
let cache = { value: null, expires: 0 };

export function invalidateSupplyMarkupCache() {
	cache = { value: null, expires: 0 };
}

export async function getSupplyMarkupPercent() {
	if (cache.value != null && Date.now() < cache.expires) {
		return cache.value;
	}

	try {
		const supabase = getSupabase();
		const { data, error } = await supabase
			.from('app_settings')
			.select('value')
			.eq('key', SUPPLY_MARKUP_SETTINGS_KEY)
			.maybeSingle();

		if (error) {
			if (error.code === 'PGRST205' || error.code === '42P01') {
				cache = { value: DEFAULT_SUPPLY_MARKUP_PERCENT, expires: Date.now() + CACHE_MS };
				return DEFAULT_SUPPLY_MARKUP_PERCENT;
			}
			throw error;
		}

		const value = parseMarkupPercent(data?.value?.percent ?? data?.value);
		cache = { value, expires: Date.now() + CACHE_MS };
		return value;
	} catch (err) {
		console.warn('getSupplyMarkupPercent fallback:', err.message);
		return DEFAULT_SUPPLY_MARKUP_PERCENT;
	}
}

export async function setSupplyMarkupPercent(percent) {
	const value = parseMarkupPercent(percent);
	const supabase = getSupabase();
	const { error } = await supabase
		.from('app_settings')
		.upsert(
			{
				key: SUPPLY_MARKUP_SETTINGS_KEY,
				value: { percent: value },
				updated_at: new Date().toISOString(),
			},
			{ onConflict: 'key' },
		);
	if (error) throw error;
	cache = { value, expires: Date.now() + CACHE_MS };
	return value;
}
