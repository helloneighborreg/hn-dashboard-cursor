import { calendarMonthDateRange } from './taskFilters';
import { TASK_TAB_PATHS } from './taskRoutes';

export const EMPTY_TASK_COUNTS = {
	unassigned: 0,
	assigned: 0,
	under_review: 0,
	completed: 0,
	overdue: 0,
};

/** Map a tasks submenu href to its widget count key. */
export function taskCountKeyForHref(href) {
	return Object.entries(TASK_TAB_PATHS).find(([, path]) => path === href)?.[0] ?? null;
}

export function buildTaskFilterParams(applied, { isCalendar = false, monthKey } = {}) {
	const params = new URLSearchParams();
	if (applied.property_id) params.set('property_id', applied.property_id);
	if (applied.status) params.set('status', applied.status);
	if (applied.assignee) params.set('assignee', applied.assignee);

	if (isCalendar && monthKey) {
		const range = calendarMonthDateRange(monthKey);
		if (range) {
			params.set('date_from', range.date_from);
			params.set('date_to', range.date_to);
		}
		params.set('calendar', 'true');
	} else if (applied.today) {
		params.set('today', 'true');
	} else {
		if (applied.date_from) params.set('date_from', applied.date_from);
		if (applied.date_to) params.set('date_to', applied.date_to);
	}

	return params;
}

export function buildTaskCountsParams(applied, options = {}) {
	const params = buildTaskFilterParams(applied, options);
	params.set('counts_only', 'true');
	return params;
}
