/** Canonical task tab order: Unassigned → Assigned → Completed → Review → Overdue */
export const TASK_TAB_ORDER = [
	'unassigned',
	'assigned',
	'completed',
	'under_review',
	'overdue',
];

export const TASK_TAB_LABELS = {
	unassigned: 'Unassigned',
	assigned: 'Assigned',
	completed: 'Completed',
	under_review: 'Review',
	overdue: 'Overdue',
};

export const TASK_TAB_PATHS = {
	unassigned: '/tasks/unassigned',
	assigned: '/tasks/assigned',
	completed: '/tasks/completed',
	under_review: '/tasks/under-review',
	overdue: '/tasks/overdue',
};

export function tabFromPathname(pathname) {
	return Object.entries(TASK_TAB_PATHS).find(([, path]) => path === pathname)?.[0] ?? null;
}

export function taskPathForTab(tab) {
	return TASK_TAB_PATHS[tab] || TASK_TAB_PATHS.unassigned;
}
