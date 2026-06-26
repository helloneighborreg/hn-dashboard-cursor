import { withAuth, isAdmin } from '../../../lib/auth';
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
import { getTasks } from '../../../lib/db';
import { sortTasksByDateAsc, sortTasksByDateDesc } from '../../../lib/constants';
import { enrichTasks } from '../../../lib/taskEnrich';
import { withChecklistUrl } from '../../../lib/checklistUrl';
import { sanitizeTasksForViewer } from '../../../lib/taskSanitize';
import { filterHiddenPropertyRows } from '../../../lib/hiddenProperties';
import { format, addDays } from 'date-fns';

const CACHE_TTL_MS = 60_000;
const TASK_LIST_LIMIT = 50;

async function buildAdminDashboardData() {
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
		view: 'full',
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

async function buildUserTaskDashboardData(session, navPermissions) {
	const assignee = session.user?.name;
	const todayStr = format(new Date(), 'yyyy-MM-dd');

	const [todayRows, completedRows, overdueRows] = await Promise.all([
		getTasks({
			due_date: todayStr,
			assignee,
			assigned: true,
			exclude_completed: true,
			sort_soonest: true,
			limit: TASK_LIST_LIMIT,
		}),
		getTasks({
			assignee,
			status: 'completed',
			limit: TASK_LIST_LIMIT,
		}),
		getTasks({
			assignee,
			assigned: true,
			exclude_completed: true,
			overdue: true,
			sort_soonest: true,
			limit: TASK_LIST_LIMIT,
		}),
	]);

	const [todayEnriched, completedEnriched, overdueEnriched] = await Promise.all([
		enrichTasks(filterHiddenPropertyRows(todayRows)),
		enrichTasks(filterHiddenPropertyRows(completedRows)),
		enrichTasks(filterHiddenPropertyRows(overdueRows)),
	]);

	const tasksToday = sortTasksByDateAsc(
		sanitizeTasksForViewer(
			todayEnriched.map(withChecklistUrl),
			session.user,
			navPermissions,
		),
	);
	const tasksCompleted = sortTasksByDateDesc(
		sanitizeTasksForViewer(
			completedEnriched.map(withChecklistUrl),
			session.user,
			navPermissions,
		),
	);
	const tasksOverdue = sortTasksByDateAsc(
		sanitizeTasksForViewer(
			overdueEnriched.map(withChecklistUrl),
			session.user,
			navPermissions,
		),
	);

	return {
		view: 'tasks',
		today: todayStr,
		tasks_today: tasksToday,
		tasks_completed: tasksCompleted,
		tasks_overdue: tasksOverdue,
		stats: {
			tasks_today: tasksToday.length,
			tasks_completed: tasksCompleted.length,
			tasks_overdue: tasksOverdue.length,
		},
	};
}

export default async function handler(req, res) {
	await withAuth(req, res, async (session, navPermissions) => {
		if (req.method !== 'GET') {
			res.status(405).end();
			return;
		}

		if (isAdmin(session.user)) {
			const data = await getCached('dashboard', CACHE_TTL_MS, buildAdminDashboardData);
			res.json({ data });
			return;
		}

		const cacheKey = `dashboard:tasks:${session.user?.username || session.user?.name || 'user'}`;
		const data = await getCached(
			cacheKey,
			CACHE_TTL_MS,
			() => buildUserTaskDashboardData(session, navPermissions),
		);
		res.json({ data });
	});
}
