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
		fillout_forms_set: Boolean(process.env.FILLOUT_CHECKLIST_FORMS?.trim() || process.env.FILLOUT_CHECKLIST_BASE_URL?.trim()),
		fillout_webhook_secret_set: Boolean(process.env.FILLOUT_WEBHOOK_SECRET?.trim()),
		fillout_api_token_set: Boolean(process.env.FILLOUT_API_TOKEN?.trim() || process.env.FILLOUT_API_KEY?.trim()),
		fillout_webhook_url: '/api/webhooks/fillout',
		fillout_backfill_url: '/api/tasks/backfill-fillout',
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
