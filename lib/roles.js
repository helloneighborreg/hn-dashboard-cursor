import { TASK_TAB_PATHS } from './taskRoutes';
import { FORMS_NAV_PARENT, FORM_NAV_ITEMS } from './formsNav';

export const ROLES = {
	ADMIN: 'admin',
	CLEANER: 'cleaner',
};

/** Page path prefixes cleaners may open. */
export const CLEANER_PATH_PREFIXES = ['/tasks'];

/** API routes blocked for cleaners (admins only). */
export const ADMIN_ONLY_API_PREFIXES = [
	'/api/dashboard',
	'/api/financials',
	'/api/bank',
	'/api/expenses',
	'/api/reservations',
	'/api/calendar',
	'/api/properties',
	'/api/tasks/sync',
	'/api/tasks/backfill-fillout',
	'/api/setup-check',
	'/api/reports',
];

export function isAdmin(user) {
	return user?.role === ROLES.ADMIN;
}

export function isCleaner(user) {
	return user?.role === ROLES.CLEANER;
}

/** Simplified tasks UI: no status widgets or unassigned tab (cleaners and task-only accounts). */
export function hasLimitedTasksView(user) {
	if (!user) return false;
	if (isCleaner(user)) return true;
	// Fallback when a task-only user is misconfigured as admin in DASHBOARD_USERS.
	return user.username?.toLowerCase() === 'brandi';
}

export function canAccessPath(user, pathname) {
	if (!user) return false;
	if (isAdmin(user)) return true;
	const path = pathname?.split('?')[0] || '';
	return CLEANER_PATH_PREFIXES.some(
		(prefix) => path === prefix || path.startsWith(`${prefix}/`),
	);
}

export function canAccessApi(user, pathname) {
	if (!user) return false;
	if (isAdmin(user)) return true;
	const path = pathname?.split('?')[0] || '';
	if (ADMIN_ONLY_API_PREFIXES.some(
		(prefix) => path === prefix || path.startsWith(`${prefix}/`),
	)) {
		return false;
	}
	return path.startsWith('/api/tasks') || path.startsWith('/api/auth');
}

export function homePathForRole(role) {
	return role === ROLES.ADMIN ? '/dashboard' : TASK_TAB_PATHS.assigned;
}

export function roleLabel(role) {
	if (role === ROLES.ADMIN) return 'Admin';
	if (role === ROLES.CLEANER) return 'Cleaner';
	return role || 'User';
}

/** Nav items visible in the sidebar by role. */
export const NAV_ITEMS = [
	{ href: '/dashboard', label: 'Dashboard', roles: [ROLES.ADMIN] },
	{ href: '/properties', label: 'Properties', roles: [ROLES.ADMIN] },
	{ href: '/reservations', label: 'Reservations', roles: [ROLES.ADMIN] },
	{ href: '/calendar', label: 'Calendar', roles: [ROLES.ADMIN], parent: '/reservations' },
	{ href: '/tasks', label: 'Tasks', roles: [ROLES.ADMIN, ROLES.CLEANER] },
	{ href: '/tasks/unassigned', label: 'Unassigned', roles: [ROLES.ADMIN], parent: '/tasks' },
	{ href: '/tasks/assigned', label: 'Assigned', roles: [ROLES.ADMIN, ROLES.CLEANER], parent: '/tasks' },
	{ href: '/tasks/under-review', label: 'Under Review', roles: [ROLES.ADMIN, ROLES.CLEANER], parent: '/tasks' },
	{ href: '/tasks/overdue', label: 'Overdue', roles: [ROLES.ADMIN, ROLES.CLEANER], parent: '/tasks' },
	{ href: '/tasks/completed', label: 'Completed', roles: [ROLES.ADMIN, ROLES.CLEANER], parent: '/tasks' },
	{ href: FORMS_NAV_PARENT, label: 'Forms', allUsers: true, toggleOnly: true },
	...FORM_NAV_ITEMS.map((form) => ({
		...form,
		allUsers: true,
		parent: FORMS_NAV_PARENT,
	})),
	{ href: '/financials', label: 'Financials', roles: [ROLES.ADMIN] },
	{ href: '/transactions', label: 'Transactions', roles: [ROLES.ADMIN], parent: '/financials' },
	{ href: '/reports', label: 'Reports', roles: [ROLES.ADMIN], parent: '/financials' },
];

export function navItemsForRole(role) {
	if (!role) return [];
	return NAV_ITEMS.filter((item) => item.allUsers || item.roles?.includes(role));
}
