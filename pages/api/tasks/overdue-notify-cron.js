import { runOverdueTaskNotify } from '../../../lib/runOverdueTaskNotify';
import { verifyCronSecret } from '../../../lib/verifyCronSecret';

/**
 * Scheduled overdue task notifications — called by Cloudflare Cron via worker.js.
 * POST /api/tasks/overdue-notify-cron
 * Header: Authorization: Bearer <CRON_SECRET>  (or x-cron-secret)
 */
export default async function handler(req, res) {
	if (req.method !== 'POST') return res.status(405).end();
	if (!verifyCronSecret(req, res)) return;

	try {
		const result = await runOverdueTaskNotify();
		res.json({ ok: true, source: 'cron', ...result });
	} catch (err) {
		console.error('Overdue notify cron error:', err.message);
		res.status(502).json({ error: err.message });
	}
}
