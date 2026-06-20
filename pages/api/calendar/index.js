import { withAuth } from '../../../lib/auth';
import { getCached } from '../../../lib/cache';
import {
	getProperties,
	getReservations,
	getPropertyCalendar,
	isActiveReservation,
} from '../../../lib/hospitable';

const CACHE_TTL_MS = 60_000;

async function buildCalendarData(start, end) {
	const properties = await getProperties();
	const ids = properties.map((p) => p.id);

	const fetchFrom = start
		? new Date(new Date(start).getTime() - 365 * 24 * 60 * 60 * 1000)
			.toISOString()
			.slice(0, 10)
		: undefined;

	const { data: reservations } = await getReservations(ids, {
		perPage: 200,
		startDate: fetchFrom,
		endDate: end,
		include: 'guest',
	});

	const active = reservations.filter(isActiveReservation);

	const calResults = await Promise.allSettled(
		properties.map(async (p) => {
			const days = await getPropertyCalendar(p.id, { start, end });
			return { id: p.id, days };
		}),
	);

	const availability = {};
	calResults.forEach((result) => {
		if (result.status !== 'fulfilled') return;
		const { id, days } = result.value;
		availability[id] = {};
		(Array.isArray(days) ? days : []).forEach((day) => {
			if (!day || !day.date) return;
			const available = day.status?.available ?? day.available ?? true;
			const reason = day.status?.reason ?? day.reason ?? null;
			availability[id][day.date] = { available, reason };
		});
	});

	return { properties, reservations: active, availability };
}

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		if (req.method !== 'GET') return res.status(405).end();

		const { start, end } = req.query;

		try {
			const data = await getCached(
				`calendar:${start || ''}:${end || ''}`,
				CACHE_TTL_MS,
				() => buildCalendarData(start, end),
			);
			res.json({ data });
		} catch (err) {
			console.error('Calendar API error:', err.message);
			res.status(502).json({ error: err.message });
		}
	}, { adminOnly: true });
}
