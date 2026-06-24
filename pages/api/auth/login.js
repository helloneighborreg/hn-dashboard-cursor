import { getSession, authenticateUser, getAuthConfigStatus, applyRememberMe } from '../../../lib/auth';
import { homePathForRole } from '../../../lib/roles';
import { getClientIp, rateLimit } from '../../../lib/rateLimit';

function isFormLogin(req) {
	const ct = req.headers['content-type'] || '';
	return ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data');
}

function truthy(value) {
	if (value === undefined || value === null || value === '') return false;
	if (value === '0' || value === 'false') return false;
	return true;
}

function loginErrorRedirect(res, message) {
	const qs = new URLSearchParams({ login_error: message });
	res.redirect(303, `/?${qs.toString()}`);
}

export default async function handler(req, res) {
	if (req.method !== 'POST') return res.status(405).end();

	const formLogin = isFormLogin(req);

	// Throttle password guessing: 10 attempts per IP per minute.
	const limit = rateLimit(`login:${getClientIp(req)}`, { limit: 10, windowMs: 60_000 });
	if (!limit.allowed) {
		const message = 'Too many login attempts. Please try again shortly.';
		if (formLogin) {
			res.setHeader('Retry-After', String(limit.retryAfterSec));
			loginErrorRedirect(res, message);
			return;
		}
		res.setHeader('Retry-After', String(limit.retryAfterSec));
		return res.status(429).json({ error: message });
	}

	const { username } = req.body;
	const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
	// Default on for HTML form (checkbox omitted when unchecked).
	const rememberMe = req.body?.rememberMe === undefined ? true : truthy(req.body.rememberMe);

	if (!password) {
		const message = 'Password required';
		if (formLogin) {
			loginErrorRedirect(res, message);
			return;
		}
		return res.status(400).json({ error: message });
	}

	const config = getAuthConfigStatus();
	if (!username?.trim() && config.dashboard_user_count > 1) {
		const message = 'Username is required.';
		if (formLogin) {
			loginErrorRedirect(res, message);
			return;
		}
		return res.status(400).json({ error: message });
	}
	if (!config.login_ready) {
		let message = 'Server misconfigured: no dashboard users are configured.';
		if (!config.session_secret_ok) {
			message = 'Server misconfigured: SESSION_SECRET must be set (32+ characters).';
		} else if (config.dashboard_users_set && !config.dashboard_users_parse_ok) {
			message = `Server misconfigured: ${config.dashboard_users_parse_error || 'Invalid DASHBOARD_USERS JSON'}.`;
		}
		if (formLogin) {
			loginErrorRedirect(res, message);
			return;
		}
		return res.status(503).json({ error: message });
	}

	try {
		const user = await authenticateUser(username, password);
		if (!user) {
			const message = 'Invalid username or password';
			if (formLogin) {
				const hint = process.env.NODE_ENV === 'development'
					? `${message}. Use the password from env.local (not production).`
					: message;
				loginErrorRedirect(res, hint);
				return;
			}
			return res.status(401).json({ error: message });
		}

		const session = await getSession(req, res);
		session.user = user;
		if (rememberMe) {
			session.remember_me = true;
			applyRememberMe(session);
		}
		await session.save();

		const redirect = homePathForRole(user.role);
		if (formLogin) {
			res.redirect(303, redirect);
			return;
		}

		return res.json({
			ok: true,
			user,
			redirect,
		});
	} catch (err) {
		console.error('Login failed:', err);
		const message = 'Could not create session. Check SESSION_SECRET on the server.';
		if (formLogin) {
			loginErrorRedirect(res, message);
			return;
		}
		return res.status(500).json({ error: message });
	}
}
