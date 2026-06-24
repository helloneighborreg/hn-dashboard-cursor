import { withAuth } from '../../../../lib/auth';
import { getSupplyOrders } from '../../../../lib/suppliesDb';

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		if (req.method === 'GET') {
			return res.json({ data: await getSupplyOrders() });
		}
		res.status(405).end();
	}, { adminOnly: true });
}
