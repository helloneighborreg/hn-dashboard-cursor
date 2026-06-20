import { withAuth } from '../../../lib/auth';
import {
	getReservation,
	getProperties,
	getReservations,
	buildPropertyMap,
	fetchReservationsForSync,
} from '../../../lib/hospitable';
import { getReservationCode } from '../../../lib/codes';
import { syncTasksFromReservations } from '../../../lib/syncReservationTasks';

/**
 * Force-sync one reservation by code (e.g. HM29W9SFTR).
 * POST /api/tasks/sync-reservation?code=HM29W9SFTR
 */
export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		if (req.method !== 'POST') return res.status(405).end();

		const code = String(req.query.code || req.body?.code || '').trim().toUpperCase();
		if (!code) {
			return res.status(400).json({ error: 'Missing code query param (e.g. ?code=HM29W9SFTR)' });
		}

		try {
			const { propMap, reservations } = await fetchReservationsForSync();
			let match = reservations.find((r) => getReservationCode(r) === code);

			if (!match) {
				const properties = await getProperties();
				const ids = properties.map((p) => p.id);
				const mergedMap = buildPropertyMap(properties);
				for (const dateQuery of ['checkout', 'checkin']) {
					const { data } = await getReservations(ids, {
						perPage: 100,
						maxPages: 80,
						startDate: '2020-01-01',
						endDate: '2030-12-31',
						dateQuery,
						include: 'guest',
					});
					match = (data || []).find((r) => getReservationCode(r) === code);
					if (match) break;
				}
				Object.assign(propMap, mergedMap);
			}

			if (!match?.id) {
				return res.status(404).json({ error: `Reservation ${code} not found in Hospitable` });
			}

			try {
				const direct = await getReservation(match.id);
				if (direct && getReservationCode(direct) === code) {
					match = { ...match, ...direct };
				}
			} catch {
				// list row is enough
			}

			const result = await syncTasksFromReservations([match], propMap);
			return res.json({ ok: true, code, ...result });
		} catch (err) {
			console.error('sync-reservation error:', err.message);
			return res.status(502).json({ error: err.message });
		}
	}, { adminOnly: true });
}
