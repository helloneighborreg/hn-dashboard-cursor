import { getSupabase } from './supabase.js';
import {
	getDefaultNavPermissions,
	mergeNavPermissions,
	NAV_PERMISSIONS_KEY,
	sanitizeNavPermissions,
} from './navPermissions';

const CACHE_MS = 30_000;
let cache = { value: null, expires: 0 };

export function invalidateNavPermissionsCache() {
	cache = { value: null, expires: 0 };
}

export async function getNavPermissions() {
	const defaults = getDefaultNavPermissions();
	if (cache.value && Date.now() < cache.expires) {
		return cache.value;
	}

	try {
		const supabase = getSupabase();
		const { data, error } = await supabase
			.from('app_settings')
			.select('value')
			.eq('key', NAV_PERMISSIONS_KEY)
			.maybeSingle();

		if (error) {
			if (error.code === 'PGRST205' || error.code === '42P01') {
				cache = { value: defaults, expires: Date.now() + CACHE_MS };
				return defaults;
			}
			throw error;
		}

		const merged = sanitizeNavPermissions(mergeNavPermissions(defaults, data?.value), defaults);
		cache = { value: merged, expires: Date.now() + CACHE_MS };
		return merged;
	} catch (err) {
		console.warn('getNavPermissions fallback:', err.message);
		return defaults;
	}
}

export async function setNavPermissions(input) {
	const defaults = getDefaultNavPermissions();
	const value = sanitizeNavPermissions(input, defaults);
	const supabase = getSupabase();
	const { error } = await supabase
		.from('app_settings')
		.upsert(
			{ key: NAV_PERMISSIONS_KEY, value, updated_at: new Date().toISOString() },
			{ onConflict: 'key' },
		);
	if (error) throw error;
	cache = { value, expires: Date.now() + CACHE_MS };
	return value;
}
