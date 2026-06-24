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
	mergeReservationsById,
} from '../../../lib/hospitable';
import {
	sortReservationsByCheckInAsc,
	sortReservationsByCheckOutAsc,
} from '../../../lib/reservationDates';
import { getTasksForToday, getTaskIndicatorCounts } from '../../../lib/db';
import { enrichTasks } from '../../../lib/taskEnrich';
import { format, addDays } from 'date-fns';

const CACHE_TTL_MS = 60_000;
const RESERVATION_OPTS = { perPage: 100, maxPages: 15, include: 'guest' };

async function fetchDashboardReservations(ids, todayStr, in7days) {
	const in90days = format(addDays(new Date(), 90), 'yyyy-MM-dd');
	const [{ data: byCheckin }, { data: byCheckout }] = await Promise.all([
		getReservations(ids, {
			...RESERVATION_OPTS,
			dateQuery: 'checkin',
			startDate: todayStr,
			endDate: in7days,
		}),
		getReservations(ids, {
			...RESERVATION_OPTS,
			dateQuery: 'checkout',
			startDate: todayStr,
			endDate: in90days,
		}),
	]);
	return mergeReservationsById([...(byCheckin || []), ...(byCheckout || [])]);
}

async function buildDashboardData() {
	const todayStr = format(new Date(), 'yyyy-MM-dd');
	const in7days = format(addDays(new Date(), 7), 'yyyy-MM-dd');

	const [properties, taskRows, taskCounts] = await Promise.all([
		getProperties(),
		getTasksForToday(),
		getTaskIndicatorCounts(),
	]);

	const propMap = buildPropertyMap(properties);
	const ids = properties.map((p) => p.id);
	const all = await fetchDashboardReservations(ids, todayStr, in7days);
	const tasksToday = await enrichTasks(taskRows);

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
		tasks_today: tasksToday,
		stats: {
			occupied_count: occupied.length,
			checkins_today: checkInsToday.length,
			checkouts_today: checkOutsToday.length,
			upcoming_checkins: upcomingCheckIns.length,
			upcoming_checkouts: upcomingCheckOuts.length,
			tasks_today: tasksToday.length,
			tasks_unassigned: taskCounts.unassigned,
			tasks_overdue: taskCounts.overdue,
			tasks_completed: taskCounts.completed,
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
