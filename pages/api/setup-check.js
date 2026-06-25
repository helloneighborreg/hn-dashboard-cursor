/**
 * Quick config check (no secrets exposed).
 * Development: open /api/setup-check without auth.
 * Production: admin session required.
 */
import { withAuth, getAssigneeNotifyStatus } from '../../lib/auth';
import { ASSIGNEES } from '../../lib/constants';

function buildCheckResponse() {
	const token = (process.env.HOSPITABLE_API_TOKEN || '').trim();
	const hasUsers =
		Boolean(process.env.DASHBOARD_USERS?.trim()) ||
		Boolean(process.env.DASHBOARD_PASSWORD?.trim());
	const assigneeNotify = getAssigneeNotifyStatus(ASSIGNEES.filter((a) => a !== 'Other'));
	const missingAssigneeContacts = assigneeNotify.filter((a) => !a.has_contact).map((a) => a.assignee);
	return {
		ok: Boolean(token && process.env.SUPABASE_URL && hasUsers),
		hospitable_token_set: Boolean(token),
		hospitable_token_length: token.length,
		supabase_url_set: Boolean(process.env.SUPABASE_URL),
		dashboard_users_set: Boolean(process.env.DASHBOARD_USERS?.trim()),
		dashboard_password_set: Boolean(process.env.DASHBOARD_PASSWORD?.trim()),
		session_secret_set: Boolean(process.env.SESSION_SECRET?.trim()),
		task_notify_email_configured: Boolean(
			process.env.RESEND_API_KEY?.trim() && process.env.TASK_NOTIFY_FROM_EMAIL?.trim(),
		),
		assignee_notify: assigneeNotify,
		assignee_notify_missing: missingAssigneeContacts,
		hint:
			!token
				? 'Add HOSPITABLE_API_TOKEN in Cloudflare → Workers → Settings → Variables and Secrets, then redeploy with --keep-vars.'
				: token.length < 20
					? 'HOSPITABLE_API_TOKEN looks too short — paste the full token from Hospitable.'
					: missingAssigneeContacts.length
					? `Add email/phone for ${missingAssigneeContacts.join(', ')} in DASHBOARD_USERS or TASK_ASSIGNEE_CONTACTS.`
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
