import { getIronSession } from 'iron-session';
import bcrypt from 'bcryptjs';
import { canAccessPath, canAccessApi, homePathForRole, isAdmin, isCleaner, ROLES } from './roles';

function getSessionPassword() {
	const secret = process.env.SESSION_SECRET?.trim();
	// Skip strict validation during `next build` (page-data collection); enforce at runtime.
	const isBuild = process.env.NEXT_PHASE === 'phase-production-build';
	if (process.env.NODE_ENV === 'production' && !isBuild) {
		if (!secret || secret.length < 32) {
			throw new Error(
				'SESSION_SECRET must be set to a random string of at least 32 characters in production.',
			);
		}
		return secret;
	}
	return secret || 'fallback-secret-change-me-in-env-32-chars!';
}

function getSessionOptions() {
	return {
		password: getSessionPassword(),
		cookieName: 'hn_session',
		cookieOptions: {
			secure: process.env.NODE_ENV === 'production',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7,
		},
	};
}

export async function getSession(req, res) {
	return getIronSession(req, res, getSessionOptions());
}

async function passwordMatches(input, stored) {
	if (!stored) return false;
	if (stored.startsWith('$2')) {
		return bcrypt.compare(input, stored);
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

	const legacy = process.env.DASHBOARD_PASSWORD?.trim();
	if (legacy) {
		return [
			{
				username: 'admin',
				name: process.env.DASHBOARD_ADMIN_NAME || 'Admin',
				role: ROLES.ADMIN,
				password: legacy,
				email: process.env.DASHBOARD_ADMIN_EMAIL?.trim() || '',
				phone: process.env.DASHBOARD_ADMIN_PHONE?.trim() || '',
			},
		];
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

	const legacyPassword = Boolean(process.env.DASHBOARD_PASSWORD?.trim());
	const sessionSecretOk = Boolean(secret && secret.length >= 32);

	return {
		login_ready: sessionSecretOk && (users.length > 0 || legacyPassword),
		session_secret_ok: sessionSecretOk,
		dashboard_users_set: Boolean(raw),
		dashboard_users_parse_ok: raw ? usersParseOk : null,
		dashboard_users_parse_error: usersParseError,
		dashboard_user_count: users.length,
		dashboard_usernames: users.map((u) => u.username),
		dashboard_password_set: legacyPassword,
		has_cleaner: users.some((u) => u.role === ROLES.CLEANER),
	};
}

/** Email/phone for task assignment notifications (matches assignee dropdown name). */
export function getAssigneeContact(assigneeName) {
	const name = String(assigneeName || '').trim();
	if (!name) return null;

	try {
		const fromMap = JSON.parse(process.env.TASK_ASSIGNEE_CONTACTS || '{}')[name];
		if (fromMap?.email || fromMap?.phone) {
			return {
				email: fromMap.email ? String(fromMap.email).trim() : '',
				phone: fromMap.phone ? String(fromMap.phone).trim() : '',
			};
		}
	} catch {
		// ignore invalid TASK_ASSIGNEE_CONTACTS
	}

	const user = loadDashboardUsers().find((u) => u.name === name);
	if (user?.email || user?.phone) {
		return { email: user.email || '', phone: user.phone || '' };
	}

	return null;
}

/** @returns {Promise<{ username: string, name: string, role: string } | null>} */
export async function authenticateUser(username, password) {
	if (!password) return null;

	const users = loadDashboardUsers();
	if (!users.length) return null;

	const normalized = username?.trim().toLowerCase();
	let matches = users;

	if (normalized) {
		matches = users.filter(
			(u) =>
				u.username.toLowerCase() === normalized
				|| u.name.toLowerCase() === normalized,
		);
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

export { isAdmin, isCleaner };

export async function withAuth(req, res, handler, options = {}) {
	const session = await getSession(req, res);
	if (!session?.user) {
		res.status(401).json({ error: 'Unauthorized' });
		return;
	}
	const pathname = (req.url || '').split('?')[0];
	if (!canAccessApi(session.user, pathname)) {
		res.status(403).json({ error: 'Forbidden' });
		return;
	}
	if (options.adminOnly && !isAdmin(session.user)) {
		res.status(403).json({ error: 'Forbidden' });
		return;
	}
	return handler(session);
}

export function requireAuth(gssp) {
	return async (context) => {
		const { req, res, resolvedUrl } = context;
		const session = await getSession(req, res);
		if (!session?.user) {
			return { redirect: { destination: '/', permanent: false } };
		}

		const pathname = (resolvedUrl || '').split('?')[0] || context.pathname || '';
		if (!canAccessPath(session.user, pathname)) {
			return {
				redirect: { destination: homePathForRole(session.user.role), permanent: false },
			};
		}

		const result = gssp
			? await gssp(context, session)
			: { props: {} };

		if (result?.props !== undefined) {
			result.props = { ...result.props, user: session.user };
		}

		return result;
	};
}
