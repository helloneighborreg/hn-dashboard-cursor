import { getSession, authenticateUser } from '../../../lib/auth';
import { homePathForRole } from '../../../lib/roles';

export default async function handler(req, res) {
	if (req.method !== 'POST') return res.status(405).end();

	const { username, password } = req.body;
	if (!password) return res.status(400).json({ error: 'Password required' });

	const user = await authenticateUser(username, password);
	if (!user) {
		return res.status(401).json({ error: 'Invalid username or password' });
	}

	const session = await getSession(req, res);
	session.user = user;
	await session.save();

	res.json({
		ok: true,
		user,
		redirect: homePathForRole(user.role),
	});
}
