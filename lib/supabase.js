import { createClient } from '@supabase/supabase-js';

let client = null;

function assertSupabaseUrl(url) {
	const normalized = url.replace(/\/$/, '');
	if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(normalized)) {
		throw new Error(
			'Invalid SUPABASE_URL. Use the Project URL from Supabase → Settings → API ' +
				'(format: https://abcdefghijklmnop.supabase.co). ' +
				'Do not use the supabase.com dashboard link from your browser.',
		);
	}
	return normalized;
}

/** Server-only Supabase client (uses service role — never expose to the browser). */
export function getSupabase() {
	if (!client) {
		const url = process.env.SUPABASE_URL;
		const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
		if (!url || !key) {
			throw new Error(
				'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to env.local or Cloudflare Worker secrets.',
			);
		}
		const apiUrl = assertSupabaseUrl(url);
		client = createClient(apiUrl, key, {
			auth: { persistSession: false, autoRefreshToken: false },
		});
	}
	return client;
}
