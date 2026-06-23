import { withAuth } from '../../../lib/auth';
import { getCached } from '../../../lib/cache';
import {
	getProperties,
	getReservations,
	buildPropertyMap,
	isActiveReservation,
	reservationCheckIn,
	reservationCheckOut,
	withReservationPropertyName,
} from '../../../lib/hospitable';
import {
	sortReservationsByCheckInAsc,
	sortReservationsByCheckOutAsc,
} from '../../../lib/reservationDates';
import { format, addDays } from 'date-fns';

const CACHE_TTL_MS = 60_000;

async function buildDashboardData() {
	const properties = await getProperties();
	const propMap = buildPropertyMap(properties);
	const ids = properties.map((p) => p.id);

	const todayStr = format(new Date(), 'yyyy-MM-dd');
	const in7days = format(addDays(new Date(), 7), 'yyyy-MM-dd');
	const fetchFrom = format(addDays(new Date(), -90), 'yyyy-MM-dd');

	const { data: all } = await getReservations(ids, {
		perPage: 200,
		startDate: fetchFrom,
		endDate: in7days,
		include: 'guest',
	});

	const active = all.filter(isActiveReservation);
	const wp = (r) => withReservationPropertyName(r, propMap);
	const ci = reservationCheckIn;
	const co = reservationCheckOut;

	const occupied = sortReservationsByCheckOutAsc(
		active.filter((r) => ci(r) <= todayStr && co(r) > todayStr).map(wp),
	);
	const checkInsToday = active.filter((r) => ci(r) === todayStr).map(wp);
	const checkOutsToday = active.filter((r) => co(r) === todayStr).map(wp);
	const upcomingCheckIns = sortReservationsByCheckInAsc(
		active.filter((r) => ci(r) > todayStr && ci(r) <= in7days).map(wp),
	);
	const upcomingCheckOuts = sortReservationsByCheckOutAsc(
		active.filter((r) => co(r) > todayStr && co(r) <= in7days).map(wp),
	);

	return {
		today: todayStr,
		properties_count: properties.length,
		occupied,
		check_ins_today: checkInsToday,
		check_outs_today: checkOutsToday,
		upcoming_check_ins: upcomingCheckIns,
		upcoming_check_outs: upcomingCheckOuts,
		stats: {
			occupied_count: occupied.length,
			checkins_today: checkInsToday.length,
			checkouts_today: checkOutsToday.length,
			upcoming_checkins: upcomingCheckIns.length,
			upcoming_checkouts: upcomingCheckOuts.length,
		},
	};
}

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		if (req.method !== 'GET') {
			res.status(405).end();
			return;
		}

		const data = await getCached('dashboard', CACHE_TTL_MS, buildDashboardData);
		res.json({ data });
	}, { adminOnly: true });
}
