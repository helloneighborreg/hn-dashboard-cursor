import { withAuth } from '../../../../../lib/auth';
import { markSupplyOrderPaid } from '../../../../../lib/suppliesDb';

export default async function handler(req, res) {
	await withAuth(req, res, async (session) => {
		if (req.method !== 'POST') return res.status(405).end();
		const { id } = req.query;
		if (!id) return res.status(400).json({ error: 'Order id is required' });
		const order = await markSupplyOrderPaid(
			id,
			session?.user?.name || session?.user?.username || null,
		);
		return res.json({ data: order });
	});
}
