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
	'/api/expenses',
	'/api/reservations',
	'/api/calendar',
	'/api/properties',
	'/api/tasks/sync',
	'/api/setup-check',
];

export function isAdmin(user) {
	return user?.role === ROLES.ADMIN;
}

export function isCleaner(user) {
	return user?.role === ROLES.CLEANER;
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
	return role === ROLES.ADMIN ? '/dashboard' : '/tasks?tab=assigned';
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
	{ href: '/calendar', label: 'Calendar', roles: [ROLES.ADMIN] },
	{ href: '/reservations', label: 'Reservations', roles: [ROLES.ADMIN] },
	{ href: '/tasks', label: 'Tasks', roles: [ROLES.ADMIN, ROLES.CLEANER] },
	{ href: '/financials', label: 'Financials', roles: [ROLES.ADMIN] },
];

export function navItemsForRole(role) {
	return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
