import { getSession, authenticateUser, getAuthConfigStatus } from '../../../lib/auth';
import { homePathForRole } from '../../../lib/roles';

export default async function handler(req, res) {
	if (req.method !== 'POST') return res.status(405).end();

	const { username, password } = req.body;
	if (!password) return res.status(400).json({ error: 'Password required' });

	const config = getAuthConfigStatus();
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
