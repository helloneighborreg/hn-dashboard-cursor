import { fetchWithTimeout } from '../../lib/httpFetch';

/**
 * Lightweight liveness/connectivity check. Public, returns no secrets — only whether the
 * app can reach its database. Useful for spotting a paused/offline Supabase project, which
 * otherwise surfaces as silent data-loading failures across the dashboard.
 *
 * Probes the Supabase PostgREST root directly: a reachable project answers < 500 (200/401/
 * 404), while a paused/offline one returns a Cloudflare 5xx/1016 page or fails DNS entirely.
 */
export default async function handler(req, res) {
	const result = { ok: true, checks: { database: 'ok' } };
	const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

	try {
		if (!url || !key) {
			result.ok = false;
			result.checks.database = 'not_configured';
			result.detail = 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set';
		} else {
			const probe = await fetchWithTimeout(
				`${url}/rest/v1/`,
				{ headers: { apikey: key, Authorization: `Bearer ${key}` } },
				5000,
			);
			if (probe.status >= 500 || probe.status === 1016) {
				result.ok = false;
				result.checks.database = 'unreachable';
				result.detail = `Supabase project responded ${probe.status} (likely paused or offline)`;
			}
		}
	} catch (err) {
		result.ok = false;
		result.checks.database = 'unreachable';
		result.detail = String(err?.message || 'connection failed');
	}

	res.setHeader('Cache-Control', 'no-store');
	res.status(result.ok ? 200 : 503).json(result);
}
