import { withAuth } from '../../../../../lib/auth';
import { submitSupplyOrder } from '../../../../../lib/suppliesDb';

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		if (req.method !== 'POST') return res.status(405).end();
		const { id } = req.query;
		if (!id) return res.status(400).json({ error: 'Order id is required' });
		const order = await submitSupplyOrder(id);
		return res.json({ data: order });
	}, { adminOnly: true });
}
