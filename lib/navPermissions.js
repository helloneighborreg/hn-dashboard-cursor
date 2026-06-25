import { FORMS_NAV_PARENT, FORM_NAV_ITEMS } from './formsNav';
import { propertySectionDefaultVisibility, propertySectionPermissionItems } from './propertySectionPermissions';
import { TASK_TAB_PATHS } from './taskRoutes';

const TASK_PERMISSION_TABS = [
	{ href: TASK_TAB_PATHS.unassigned, label: 'Unassigned' },
	{ href: TASK_TAB_PATHS.assigned, label: 'Assigned' },
	{ href: TASK_TAB_PATHS.under_review, label: 'Under Review' },
	{ href: TASK_TAB_PATHS.overdue, label: 'Overdue' },
	{ href: TASK_TAB_PATHS.completed, label: 'Completed' },
];

export const ROLES = {
	ADMIN: 'admin',
	CLEANER: 'cleaner',
};

export const NAV_PERMISSIONS_KEY = 'nav_permissions';

/** Paths that always stay available to admins (cannot be toggled off). */
export const ADMIN_LOCKED_PATHS = new Set(['/settings', '/settings/permissions']);

/** Every area that can be toggled in Settings → Permissions. */
export const PERMISSION_ITEMS = [
	{ href: '/dashboard', label: 'Dashboard', group: 'General' },
	{ href: '/properties', label: 'Properties', group: 'General' },
	...propertySectionPermissionItems(),
	{ href: '/reservations', label: 'Reservations', group: 'General' },
	{ href: '/calendar', label: 'Calendar', group: 'General' },
	{ href: '/search', label: 'Search', group: 'General' },
	{ href: '/tasks', label: 'Tasks', group: 'Tasks' },
	...TASK_PERMISSION_TABS.map(({ href, label }) => ({
		href,
		label,
		group: 'Tasks',
	})),
	{ href: FORMS_NAV_PARENT, label: 'Forms', group: 'Forms' },
	...FORM_NAV_ITEMS.map((form) => ({
		href: form.href,
		label: form.label,
		group: 'Forms',
	})),
	{ href: '/financials', label: 'Financials', group: 'Financials' },
	{ href: '/transactions', label: 'Transactions', group: 'Financials' },
	{ href: '/reports', label: 'Reports', group: 'Financials' },
	{ href: '/supplies', label: 'Supplies', group: 'Supplies' },
	{ href: '/supplies/inventory', label: 'Inventory', group: 'Supplies' },
	{ href: '/supplies/order', label: 'Supply Order', group: 'Supplies' },
];

const PERMISSION_ITEM_HREFS = new Set(PERMISSION_ITEMS.map((item) => item.href));

const DEFAULT_VISIBILITY = {
	'/dashboard': { admin: true, nonAdmin: false },
	'/properties': { admin: true, nonAdmin: false },
	...propertySectionDefaultVisibility(),
	'/reservations': { admin: true, nonAdmin: false },
	'/calendar': { admin: true, nonAdmin: false },
	'/search': { admin: true, nonAdmin: true },
	'/tasks': { admin: true, nonAdmin: true },
	'/tasks/unassigned': { admin: true, nonAdmin: false },
	'/tasks/assigned': { admin: true, nonAdmin: true },
	'/tasks/completed': { admin: true, nonAdmin: true },
	'/tasks/under-review': { admin: true, nonAdmin: true },
	'/tasks/overdue': { admin: true, nonAdmin: true },
	[FORMS_NAV_PARENT]: { admin: true, nonAdmin: false },
	...Object.fromEntries(
		FORM_NAV_ITEMS.map((form) => [form.href, { admin: true, nonAdmin: false }]),
	),
	'/financials': { admin: true, nonAdmin: false },
	'/transactions': { admin: true, nonAdmin: false },
	'/reports': { admin: true, nonAdmin: false },
	'/supplies': { admin: true, nonAdmin: false },
	'/supplies/inventory': { admin: true, nonAdmin: false },
	'/supplies/order': { admin: true, nonAdmin: false },
};

/** Map API prefixes to the nav permission key that gates them. */
export const API_PATH_PERMISSION_KEYS = [
	{ prefix: '/api/dashboard', key: '/dashboard' },
	{ prefix: '/api/properties', key: '/properties' },
	{ prefix: '/api/reservations', key: '/reservations' },
	{ prefix: '/api/calendar', key: '/calendar' },
	{ prefix: '/api/financials', key: '/financials' },
	{ prefix: '/api/bank', key: '/financials' },
	{ prefix: '/api/expenses', key: '/transactions' },
	{ prefix: '/api/reports', key: '/reports' },
	{ prefix: '/api/supplies/inventory', key: '/supplies/inventory' },
	{ prefix: '/api/supplies/orders', key: '/supplies/order' },
	{ prefix: '/api/supplies/products', key: '/supplies/order' },
	{ prefix: '/api/supplies', key: '/supplies' },
	{ prefix: '/api/forms', key: '/forms' },
	{ prefix: '/api/search', key: '/search' },
	{ prefix: '/api/tasks', key: '/tasks' },
];

function navItemDefaultVisibility(href) {
	return DEFAULT_VISIBILITY[href] || { admin: false, nonAdmin: false };
}

export function getDefaultNavPermissions() {
	return Object.fromEntries(
		PERMISSION_ITEMS.map((item) => [item.href, navItemDefaultVisibility(item.href)]),
	);
}

/** Merge stored permissions with defaults so new nav items pick up sensible defaults. */
export function mergeNavPermissions(defaults, stored) {
	if (!stored || typeof stored !== 'object') return { ...defaults };
	const merged = { ...defaults };
	for (const [href, value] of Object.entries(stored)) {
		if (!PERMISSION_ITEM_HREFS.has(href) || !value || typeof value !== 'object') continue;
		merged[href] = {
			admin: Boolean(value.admin),
			nonAdmin: Boolean(value.nonAdmin),
		};
	}
	return merged;
}

export function permissionRoleKey(role) {
	return role === ROLES.ADMIN ? 'admin' : 'nonAdmin';
}

export function isPathVisibleForRole(pathname, role, permissions) {
	const path = (pathname || '').split('?')[0];
	if (!path) return false;

	if (path === '/settings' || path.startsWith('/settings/')) {
		return role === ROLES.ADMIN;
	}

	const roleKey = permissionRoleKey(role);
	const perm = resolvePermissionForPath(path, permissions);
	if (perm) return perm[roleKey] === true;

	return role === ROLES.ADMIN;
}

export function resolvePermissionForPath(pathname, permissions) {
	const path = (pathname || '').split('?')[0];
	if (!path || !permissions) return undefined;
	if (permissions[path]) return permissions[path];

	const matches = Object.keys(permissions).filter(
		(key) => path === key || path.startsWith(`${key}/`),
	);
	if (!matches.length) return undefined;

	const key = matches.sort((a, b) => b.length - a.length)[0];
	return permissions[key];
}

export function permissionKeyForApiPath(pathname) {
	const path = (pathname || '').split('?')[0];
	if (!path) return null;
	const match = API_PATH_PERMISSION_KEYS.find(
		(entry) => path === entry.prefix || path.startsWith(`${entry.prefix}/`),
	);
	return match?.key ?? null;
}

const SUPPLIES_PATHS = ['/supplies', '/supplies/inventory', '/supplies/order'];

function isTasksApiVisibleForRole(role, permissions) {
	const roleKey = permissionRoleKey(role);
	const taskPaths = ['/tasks', ...Object.values(TASK_TAB_PATHS)];
	return taskPaths.some((href) => {
		const perm = permissions?.[href] || navItemDefaultVisibility(href);
		return perm[roleKey] === true;
	});
}

function isSuppliesApiVisibleForRole(role, permissions) {
	const roleKey = permissionRoleKey(role);
	return SUPPLIES_PATHS.some((href) => {
		const perm = permissions?.[href] || navItemDefaultVisibility(href);
		return perm[roleKey] === true;
	});
}

function isSuppliesInventoryApiVisibleForRole(role, permissions) {
	return isPathVisibleForRole('/supplies/inventory', role, permissions)
		|| isPathVisibleForRole('/supplies/order', role, permissions);
}

export function isApiVisibleForRole(pathname, role, permissions) {
	const key = permissionKeyForApiPath(pathname);
	if (!key) return null;
	if (key === '/tasks') {
		return isTasksApiVisibleForRole(role, permissions);
	}
	if (key === '/supplies') {
		return isSuppliesApiVisibleForRole(role, permissions);
	}
	if (key === '/supplies/inventory') {
		return isSuppliesInventoryApiVisibleForRole(role, permissions);
	}
	return isPathVisibleForRole(key, role, permissions);
}

export function groupPermissionItems(items = PERMISSION_ITEMS) {
	const groups = [];
	const seen = new Set();
	for (const item of items) {
		if (seen.has(item.group)) continue;
		seen.add(item.group);
		groups.push({
			group: item.group,
			items: items.filter((entry) => entry.group === item.group),
		});
	}
	return groups;
}

export function sanitizeNavPermissions(input, defaults = getDefaultNavPermissions()) {
	const source = input && typeof input === 'object' ? input : {};
	const next = { ...defaults };
	for (const [href, value] of Object.entries(source)) {
		if (!PERMISSION_ITEM_HREFS.has(href) || !value || typeof value !== 'object') continue;
		next[href] = {
			admin: ADMIN_LOCKED_PATHS.has(href) ? true : Boolean(value.admin),
			nonAdmin: ADMIN_LOCKED_PATHS.has(href) ? false : Boolean(value.nonAdmin),
		};
	}
	return next;
}
