export const TASK_TAB_PATHS = {
	unassigned: '/tasks/unassigned',
	assigned: '/tasks/assigned',
	under_review: '/tasks/under-review',
	completed: '/tasks/completed',
	overdue: '/tasks/overdue',
};

export function tabFromPathname(pathname) {
	return Object.entries(TASK_TAB_PATHS).find(([, path]) => path === pathname)?.[0] ?? null;
}

export function taskPathForTab(tab) {
	return TASK_TAB_PATHS[tab] || TASK_TAB_PATHS.unassigned;
}
