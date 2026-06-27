import { getIronSession } from 'iron-session';
import bcrypt from 'bcryptjs';
import { canAccessPath, canAccessApi, homePathForRole, isAdmin, isCleaner, ROLES } from './roles';
import { getNavPermissions } from './navPermissionsDb';

function getSessionPassword() {
	const secret = process.env.SESSION_SECRET?.trim();
	// Skip strict validation during `next build` (page-data collection); enforce at runtime.
	const isBuild = process.env.NEXT_PHASE === 'phase-production-build';
	// Enforce a real secret in every deployed environment. Only local development
	// (`next dev`, NODE_ENV=development) may fall back to a placeholder, so a misconfigured
	// staging/preview deploy can't be served with a predictable, forgeable session secret.
	if (!isBuild && process.env.NODE_ENV !== 'development') {
		if (!secret || secret.length < 32) {
			throw new Error(
				'SESSION_SECRET must be set to a random string of at least 32 characters.',
			);
		}
		return secret;
	}
	return secret || 'fallback-secret-change-me-in-env-32-chars!';
}

const DEFAULT_SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const REMEMBER_SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getSessionOptions() {
	return {
		password: getSessionPassword(),
		cookieName: 'hn_session',
		cookieOptions: {
			secure: process.env.NODE_ENV === 'production',
			httpOnly: true,
			sameSite: 'lax',
			// Default cookie lifetime. "Remember me" extends it via applyRememberMe().
			maxAge: DEFAULT_SESSION_MAX_AGE,
		},
	};
}

/**
 * Extend the session cookie lifetime for "Remember me".
 *
 * iron-session v8 has no mutable `session.cookieOptions`; the supported way to change
 * cookie/ttl settings for the next save() is session.updateConfig(). save() keeps using
 * the original password, so passing the full options here is safe.
 */
export function applyRememberMe(session) {
	if (!session || typeof session.updateConfig !== 'function') return;
	const options = getSessionOptions();
	session.updateConfig({
		...options,
		cookieOptions: { ...options.cookieOptions, maxAge: REMEMBER_SESSION_MAX_AGE },
	});
}

export async function getSession(req, res) {
	try {
		const session = await getIronSession(req, res, getSessionOptions());
		// If user opted into "Remember me", keep cookie around longer.
		if (session?.remember_me) applyRememberMe(session);
		return session;
	} catch (err) {
		// Defensive: corrupted/legacy cookies (or SESSION_SECRET rotation) can cause iron-session to throw,
		// which would otherwise surface as a 500. Treat as logged-out and clear the cookie.
		try {
			const session = await getIronSession(req, res, getSessionOptions());
			session.destroy();
		} catch {
			// ignore secondary failures
		}
		console.error('getSession failed:', err?.message || err);
		// Return a minimal empty session-like object so callers can continue safely.
		return { user: null };
	}
}

async function passwordMatches(input, stored) {
	if (!stored) return false;
	if (stored.startsWith('$2')) {
		try {
			return await bcrypt.compare(input, stored);
		} catch (err) {
			// If the stored bcrypt hash is malformed, avoid throwing a 500 on login.
			console.error('Invalid bcrypt hash for dashboard user:', err?.message || err);
			return false;
		}
	}
	return input === stored;
}

function loadDashboardUsers() {
	const raw = process.env.DASHBOARD_USERS?.trim();
	if (raw) {
		try {
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return [];
			return parsed
				.filter((u) => u?.username && u?.password)
				.map((u) => ({
					username: String(u.username).trim(),
					name: String(u.name || u.username).trim(),
					role: u.role === ROLES.CLEANER ? ROLES.CLEANER : ROLES.ADMIN,
					password: String(u.password),
					email: u.email ? String(u.email).trim() : '',
					phone: u.phone ? String(u.phone).trim() : '',
				}));
		} catch {
			console.error('DASHBOARD_USERS is not valid JSON');
			return [];
		}
	}

	return [];
}

/** Safe config summary for diagnostics (no secrets). */
export function getAuthConfigStatus() {
	const raw = process.env.DASHBOARD_USERS?.trim();
	const secret = process.env.SESSION_SECRET?.trim();
	let usersParseOk = false;
	let usersParseError = null;
	let users = [];

	if (raw) {
		try {
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) {
				usersParseError = 'DASHBOARD_USERS must be a JSON array';
			} else {
				usersParseOk = true;
				users = parsed
					.filter((u) => u?.username && u?.password)
					.map((u) => ({
						username: String(u.username).trim(),
						name: String(u.name || u.username).trim(),
						role: u.role === ROLES.CLEANER ? ROLES.CLEANER : ROLES.ADMIN,
					}));
			}
		} catch {
			usersParseError = 'DASHBOARD_USERS is invalid JSON';
		}
	}

	const sessionSecretOk = Boolean(secret && secret.length >= 32);

	return {
		login_ready: sessionSecretOk && users.length > 0,
		session_secret_ok: sessionSecretOk,
		dashboard_users_set: Boolean(raw),
		dashboard_users_parse_ok: raw ? usersParseOk : null,
		dashboard_users_parse_error: usersParseError,
		dashboard_user_count: users.length,
		dashboard_usernames: users.map((u) => u.username),
		has_cleaner: users.some((u) => u.role === ROLES.CLEANER),
	};
}

/** Display names for dashboard users with the cleaner role (task assignee format). */
export function listDashboardCleaners() {
	return loadDashboardUsers()
		.filter((u) => u.role === ROLES.CLEANER)
		.map((u) => u.name)
		.sort((a, b) => a.localeCompare(b));
}

/** Admin/owner emails for task completion and change notifications. */
export function getAdminNotifyEmails() {
	const fromEnv =
		process.env.TASK_CHANGE_NOTIFY_EMAIL?.trim()
		|| process.env.TASK_COMPLETION_NOTIFY_EMAIL?.trim();
	if (fromEnv) {
		return [...new Set(fromEnv.split(',').map((e) => e.trim()).filter(Boolean))];
	}

	const emails = loadDashboardUsers()
		.filter((u) => u.role === ROLES.ADMIN && u.email)
		.map((u) => u.email);
	return [...new Set(emails)];
}

/** Dashboard usernames for admin accounts (web push). */
export function getAdminUsernames() {
	return loadDashboardUsers()
		.filter((u) => u.role === ROLES.ADMIN)
		.map((u) => u.username)
		.filter(Boolean);
}

/** All dashboard usernames (admin + cleaner). */
export function getDashboardUsernames() {
	return loadDashboardUsers()
		.map((u) => u.username)
		.filter(Boolean);
}

function contactFromEntry(entry) {
	if (!entry?.email && !entry?.phone) return null;
	return {
		email: entry.email ? String(entry.email).trim() : '',
		phone: entry.phone ? String(entry.phone).trim() : '',
	};
}

function lookupAssigneeContactsMap(assigneeName) {
	const name = String(assigneeName || '').trim();
	if (!name) return null;

	try {
		const map = JSON.parse(process.env.TASK_ASSIGNEE_CONTACTS || '{}');
		const direct = contactFromEntry(map[name]);
		if (direct) return direct;

		const lower = name.toLowerCase();
		const key = Object.keys(map).find((k) => k.toLowerCase() === lower);
		return key ? contactFromEntry(map[key]) : null;
	} catch {
		return null;
	}
}

/** Match dashboard user to assignee dropdown value (exact, case-insensitive, username, or first name). */
export function findDashboardUserForAssignee(assigneeName) {
	const name = String(assigneeName || '').trim();
	if (!name) return null;

	const users = loadDashboardUsers();
	const exact = users.find((u) => u.name === name);
	if (exact) return exact;

	const lower = name.toLowerCase();
	const byName = users.filter((u) => u.name.toLowerCase() === lower);
	if (byName.length === 1) return byName[0];

	const byUsername = users.filter((u) => u.username.toLowerCase() === lower);
	if (byUsername.length === 1) return byUsername[0];

	const byPrefix = users.filter((u) => {
		const uName = u.name.toLowerCase();
		const uUser = u.username.toLowerCase();
		return uName.startsWith(lower) || uUser.startsWith(lower);
	});
	if (byPrefix.length === 1) return byPrefix[0];

	const byToken = users.filter((u) => {
		const firstName = u.name.toLowerCase().split(/\s+/)[0];
		const firstUser = u.username.toLowerCase().split(/\s+/)[0];
		return firstName === lower || firstUser === lower;
	});
	if (byToken.length === 1) return byToken[0];

	return null;
}

/** Email/phone for task assignment notifications (matches assignee dropdown name). */
export function getAssigneeContact(assigneeName) {
	const name = String(assigneeName || '').trim();
	if (!name) return null;

	const fromMap = lookupAssigneeContactsMap(name);
	if (fromMap) return fromMap;

	const user = findDashboardUserForAssignee(name);
	return contactFromEntry(user);
}

/** Non-secret summary of which assignees can receive task notifications. */
export function getAssigneeNotifyStatus(assigneeNames = []) {
	return assigneeNames.map((assignee) => {
		const contact = getAssigneeContact(assignee);
		return {
			assignee,
			has_email: Boolean(contact?.email),
			has_phone: Boolean(contact?.phone),
			has_contact: Boolean(contact?.email || contact?.phone),
		};
	});
}

/** @returns {Promise<{ username: string, name: string, role: string } | null>} */
export async function authenticateUser(username, password) {
	if (!password) return null;

	const users = loadDashboardUsers();
	if (!users.length) return null;

	const normalized = username?.trim().toLowerCase();
	let matches = users;

	if (normalized) {
		const exact = users.filter(
			(u) =>
				u.username.toLowerCase() === normalized
				|| u.name.toLowerCase() === normalized,
		);

		// Be forgiving when Cloudflare env accidentally sets username to a full name.
		// Allow prefix matches (e.g. "josiah" → "Josiah Burton") when unambiguous.
		if (exact.length) {
			matches = exact;
		} else {
			const prefix = users.filter((u) => {
				const uUser = u.username.toLowerCase();
				const uName = u.name.toLowerCase();
				return uUser.startsWith(normalized) || uName.startsWith(normalized);
			});

			// If still no prefix matches, try matching first token (e.g. "brandi" vs "Brandi Drieslein").
			const token = prefix.length
				? prefix
				: users.filter((u) => {
					const firstUser = u.username.toLowerCase().split(/\s+/)[0];
					const firstName = u.name.toLowerCase().split(/\s+/)[0];
					return firstUser === normalized || firstName === normalized;
				});

			matches = token.length === 1 ? token : [];
		}
	} else if (users.length === 1) {
		matches = users;
	} else {
		return null;
	}

	for (const entry of matches) {
		if (await passwordMatches(password, entry.password)) {
			return {
				username: entry.username,
				name: entry.name,
				role: entry.role,
			};
		}
	}

	return null;
}

/** True when password matches any admin dashboard user (not cleaners). */
export async function verifyAdminPassword(password) {
	if (!password) return false;

	const admins = loadDashboardUsers().filter((u) => u.role === ROLES.ADMIN);
	for (const entry of admins) {
		if (await passwordMatches(password, entry.password)) return true;
	}
	return false;
}

export { isAdmin, isCleaner };

export async function withAuth(req, res, handler, options = {}) {
	try {
		const session = await getSession(req, res);
		if (!session?.user) {
			res.status(401).json({ error: 'Unauthorized' });
			return;
		}
		const pathname = (req.url || '').split('?')[0];
		const navPermissions = await getNavPermissions();
		if (!canAccessApi(session.user, pathname, navPermissions)) {
			res.status(403).json({ error: 'Forbidden' });
			return;
		}
		if (options.adminOnly && !isAdmin(session.user)) {
			res.status(403).json({ error: 'Forbidden' });
			return;
		}
		return await handler(session, navPermissions);
	} catch (err) {
		console.error('withAuth error:', err.message);
		if (!res.headersSent) {
			res.status(500).json({ error: err.message || 'Internal server error' });
		}
	}
}

export function requireAuth(gssp) {
	return async (context) => {
		const { req, res, resolvedUrl } = context;
		const session = await getSession(req, res);
		if (!session?.user) {
			return { redirect: { destination: '/', permanent: false } };
		}

		const pathname = (resolvedUrl || '').split('?')[0] || context.pathname || '';
		const navPermissions = await getNavPermissions();
		if (!canAccessPath(session.user, pathname, navPermissions)) {
			const destination = homePathForRole(session.user.role, navPermissions);
			// Avoid infinite redirect when no permitted home route resolves safely.
			if (destination === pathname || destination === '/') {
				return { redirect: { destination: '/', permanent: false } };
			}
			return {
				redirect: {
					destination,
					permanent: false,
				},
			};
		}

		const result = gssp
			? await gssp(context, session, navPermissions)
			: { props: {} };

		if (result?.props !== undefined) {
			result.props = { ...result.props, user: session.user, navPermissions };
		}

		return result;
	};
}
