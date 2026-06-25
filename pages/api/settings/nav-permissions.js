import { withAuth } from '../../../lib/auth';
import { getNavPermissions, setNavPermissions } from '../../../lib/navPermissionsDb';

export default async function handler(req, res) {
	await withAuth(req, res, async (session) => {
		if (req.method === 'GET') {
			try {
				const permissions = await getNavPermissions();
				res.json({ data: permissions });
			} catch (err) {
				console.error('Nav permissions GET error:', err.message);
				res.status(500).json({ error: err.message });
			}
			return;
		}

		if (req.method === 'PUT') {
			if (!session.user || session.user.role !== 'admin') {
				res.status(403).json({ error: 'Forbidden' });
				return;
			}

			try {
				const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
				const permissions = await setNavPermissions(body?.permissions || body);
				res.json({ data: permissions });
			} catch (err) {
				console.error('Nav permissions PUT error:', err.message);
				res.status(500).json({ error: err.message });
			}
			return;
		}

		res.status(405).end();
	});
}
