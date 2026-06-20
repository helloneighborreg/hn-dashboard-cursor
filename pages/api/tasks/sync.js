import { withAuth } from '../../../lib/auth';
import { runReservationTaskSync } from '../../../lib/runReservationTaskSync';

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		if (req.method !== 'POST') return res.status(405).end();
		try {
			const result = await runReservationTaskSync({ skipNotify: true });
			res.json({ ok: true, ...result });
		} catch (err) {
			console.error('Task sync error:', err.message);
			res.status(502).json({ error: err.message });
		}
	}, { adminOnly: true });
}
