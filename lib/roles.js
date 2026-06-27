import { TASK_TAB_PATHS } from './taskRoutes';
import {
	getDefaultNavPermissions,
	isApiVisibleForRole,
	isPathVisibleForRole,
	ROLES,
} from './navPermissions';

export { ROLES };

/** Page path prefixes cleaners may open (includes in-app checklists under /forms). */
export const CLEANER_PATH_PREFIXES = ['/tasks', '/forms', '/search'];

function isCleanerAllowedPath(pathname) {
	const path = (pathname || '').split('?')[0];
	return CLEANER_PATH_PREFIXES.some(
		(prefix) => path === prefix || path.startsWith(`${prefix}/`),
	);
}

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
	'/api/setup-check',
	'/api/reports',
	'/api/supplies',
	'/api/billpay',
];

const RESERVATION_DATA_PATHS = ['/dashboard', '/reservations', '/calendar', '/properties'];

export function canViewReservationData(user, navPermissions) {
	if (!user) return false;
	const permissions = navPermissions || getDefaultNavPermissions();
	return RESERVATION_DATA_PATHS.some(
		(href) => isPathVisibleForRole(href, user.role, permissions),
	);
}

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

export function canAccessPath(user, pathname, navPermissions) {
	if (!user) return false;
	if (isCleaner(user) && isCleanerAllowedPath(pathname)) return true;
	const permissions = navPermissions || getDefaultNavPermissions();
	return isPathVisibleForRole(pathname, user.role, permissions);
}

export function canAccessApi(user, pathname, navPermissions) {
	if (!user) return false;
	const path = pathname?.split('?')[0] || '';
	if (path.startsWith('/api/auth')) return true;
	if (path.startsWith('/api/push')) return true;
	if (path.startsWith('/api/settings')) return isAdmin(user);
	if (isCleaner(user) && path.startsWith('/api/forms')) return true;

	const permissions = navPermissions || getDefaultNavPermissions();
	const permissionResult = isApiVisibleForRole(path, user.role, permissions);
	if (permissionResult !== null) return permissionResult;

	if (isAdmin(user)) return true;
	if (ADMIN_ONLY_API_PREFIXES.some(
		(prefix) => path === prefix || path.startsWith(`${prefix}/`),
	)) {
		return false;
	}
	return path.startsWith('/api/tasks')
		|| path.startsWith('/api/forms')
		|| path === '/api/search';
}

export function homePathForRole(role, navPermissions) {
	const permissions = navPermissions || getDefaultNavPermissions();
	const items = navItemsForRole(role, permissions).filter(
		(item) => !item.toggleOnly && !item.externalUrl,
	);
	const preferred = role === ROLES.ADMIN ? '/dashboard' : TASK_TAB_PATHS.assigned;
	const preferredItem = items.find((item) => item.href === preferred);
	if (preferredItem) return preferredItem.href;
	if (items[0]?.href) return items[0].href;
	if (isPathVisibleForRole(preferred, role, permissions)) return preferred;
	const fallback = Object.keys(permissions).find(
		(href) => isPathVisibleForRole(href, role, permissions),
	);
	return fallback || '/';
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
	{ href: '/tasks/overdue', label: 'Overdue', roles: [ROLES.ADMIN, ROLES.CLEANER], parent: '/tasks' },
	{ href: '/tasks/completed', label: 'Completed', roles: [ROLES.ADMIN, ROLES.CLEANER], parent: '/tasks' },
	{ href: '/financials', label: 'Financials', roles: [ROLES.ADMIN] },
	{ href: '/transactions', label: 'Transactions', roles: [ROLES.ADMIN], parent: '/financials' },
	{ href: '/reports', label: 'Reports', roles: [ROLES.ADMIN], parent: '/financials' },
	{ href: '/billpay', label: 'Billpay', roles: [ROLES.ADMIN] },
	{ href: '/supplies', label: 'Supplies', roles: [ROLES.ADMIN] },
	{ href: '/supplies/inventory', label: 'Inventory', roles: [ROLES.ADMIN], parent: '/supplies' },
	{ href: '/supplies/order', label: 'Supply Order', roles: [ROLES.ADMIN], parent: '/supplies' },
	{ href: '/settings', label: 'Settings', roles: [ROLES.ADMIN], toggleOnly: true },
	{ href: '/settings/permissions', label: 'Permissions', roles: [ROLES.ADMIN], parent: '/settings' },
	{ href: '/settings/checklists', label: 'Checklists', roles: [ROLES.ADMIN], parent: '/settings' },
];

export function navItemsForRole(role, navPermissions) {
	if (!role) return [];
	const permissions = navPermissions || getDefaultNavPermissions();
	return NAV_ITEMS.filter((item) => {
		if (item.href === '/settings' || item.href === '/settings/permissions' || item.href === '/settings/checklists') {
			return role === ROLES.ADMIN;
		}
		return isPathVisibleForRole(item.href, role, permissions);
	});
}
