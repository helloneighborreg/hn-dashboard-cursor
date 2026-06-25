import { withAuth } from '../../../lib/auth';
import { searchApp } from '../../../lib/appSearch';
import { getNavPermissions } from '../../../lib/navPermissionsDb';

export default async function handler(req, res) {
	await withAuth(req, res, async (session) => {
		if (req.method !== 'GET') return res.status(405).end();

		try {
			const { q } = req.query;
			const navPermissions = await getNavPermissions();
			const data = await searchApp(q, { user: session.user, navPermissions });
			res.json({ data });
		} catch (err) {
			console.error('Search API error:', err.message);
			res.status(500).json({ error: err.message });
		}
	});
}
