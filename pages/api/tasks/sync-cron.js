import { runReservationTaskSync } from '../../../lib/runReservationTaskSync';
import { verifyCronSecret } from '../../../lib/verifyCronSecret';

/**
 * Scheduled task sync — called by Cloudflare Cron via worker.js.
 * POST /api/tasks/sync-cron
 * Header: Authorization: Bearer <CRON_SECRET>  (or x-cron-secret)
 */
export default async function handler(req, res) {
	if (req.method !== 'POST') return res.status(405).end();
	if (!verifyCronSecret(req, res)) return;

	try {
		const result = await runReservationTaskSync({ skipNotify: true });
		res.json({ ok: true, source: 'cron', ...result });
	} catch (err) {
		console.error('Task sync cron error:', err.message);
		res.status(502).json({ error: err.message });
	}
}
