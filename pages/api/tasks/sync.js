import { withAuth } from '../../../lib/auth';
import { syncTasksFromReservations } from '../../../lib/syncReservationTasks';
import { fetchReservationsForSync } from '../../../lib/hospitable';

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		if (req.method !== 'POST') return res.status(405).end();
		try {
			const { propMap, reservations } = await fetchReservationsForSync();
			const result = await syncTasksFromReservations(reservations, propMap);
			res.json({ ok: true, ...result });
		} catch (err) {
			console.error('Task sync error:', err.message);
			res.status(502).json({ error: err.message });
		}
	}, { adminOnly: true });
}
