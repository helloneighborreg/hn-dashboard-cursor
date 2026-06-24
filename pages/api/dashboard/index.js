import { withAuth } from '../../../lib/auth';
import { loadDashboardData } from '../../../lib/dashboardData';

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		if (req.method !== 'GET') {
			res.status(405).end();
			return;
		}

		const data = await loadDashboardData();
		res.json({ data });
	}, { adminOnly: true });
}
