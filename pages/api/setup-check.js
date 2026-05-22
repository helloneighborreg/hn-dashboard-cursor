/**
 * Quick config check (no secrets exposed).
 * Development: open /api/setup-check without auth.
 * Production: admin session required.
 */
import { withAuth } from '../../lib/auth';

function buildCheckResponse() {
	const token = (process.env.HOSPITABLE_API_TOKEN || '').trim();
	const hasUsers =
		Boolean(process.env.DASHBOARD_USERS?.trim()) ||
		Boolean(process.env.DASHBOARD_PASSWORD?.trim());
	return {
		ok: Boolean(token && process.env.SUPABASE_URL && hasUsers),
		hospitable_token_set: Boolean(token),
		hospitable_token_length: token.length,
		supabase_url_set: Boolean(process.env.SUPABASE_URL),
		dashboard_users_set: Boolean(process.env.DASHBOARD_USERS?.trim()),
		dashboard_password_set: Boolean(process.env.DASHBOARD_PASSWORD?.trim()),
		session_secret_set: Boolean(process.env.SESSION_SECRET?.trim()),
		hint:
			!token
				? 'Add HOSPITABLE_API_TOKEN in Vercel → Settings → Environment Variables → Production, then Redeploy.'
				: token.length < 20
					? 'HOSPITABLE_API_TOKEN looks too short — paste the full token from Hospitable.'
					: null,
	};
}

export default async function handler(req, res) {
	const respond = () => res.json(buildCheckResponse());

	if (process.env.NODE_ENV === 'production') {
		await withAuth(req, res, respond, { adminOnly: true });
		return;
	}

	respond();
}
