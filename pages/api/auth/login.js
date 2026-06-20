import { getSession, authenticateUser, getAuthConfigStatus, applyRememberMe } from '../../../lib/auth';
import { homePathForRole } from '../../../lib/roles';
import { getClientIp, rateLimit } from '../../../lib/rateLimit';

export default async function handler(req, res) {
	if (req.method !== 'POST') return res.status(405).end();

	// Throttle password guessing: 10 attempts per IP per minute.
	const limit = rateLimit(`login:${getClientIp(req)}`, { limit: 10, windowMs: 60_000 });
	if (!limit.allowed) {
		res.setHeader('Retry-After', String(limit.retryAfterSec));
		return res.status(429).json({ error: 'Too many login attempts. Please try again shortly.' });
	}

	const { username, password, rememberMe } = req.body;
	if (!password) return res.status(400).json({ error: 'Password required' });

	const config = getAuthConfigStatus();
	if (!username?.trim() && config.dashboard_user_count > 1) {
		return res.status(400).json({ error: 'Username is required.' });
	}
	if (!config.login_ready) {
		if (!config.session_secret_ok) {
			return res.status(503).json({
				error: 'Server misconfigured: SESSION_SECRET must be set (32+ characters).',
			});
		}
		if (config.dashboard_users_set && !config.dashboard_users_parse_ok) {
			return res.status(503).json({
				error: `Server misconfigured: ${config.dashboard_users_parse_error || 'Invalid DASHBOARD_USERS JSON'}.`,
			});
		}
		return res.status(503).json({
			error: 'Server misconfigured: no dashboard users are configured.',
		});
	}

	try {
		const user = await authenticateUser(username, password);
		if (!user) {
			return res.status(401).json({ error: 'Invalid username or password' });
		}

		const session = await getSession(req, res);
		session.user = user;
		// Default cookie is 7 days; "Remember me" extends it for easier login.
		if (rememberMe) {
			session.remember_me = true;
			applyRememberMe(session);
		}
		await session.save();

		return res.json({
			ok: true,
			user,
			redirect: homePathForRole(user.role),
		});
	} catch (err) {
		console.error('Login failed:', err);
		return res.status(500).json({ error: 'Could not create session. Check SESSION_SECRET on the server.' });
	}
}
