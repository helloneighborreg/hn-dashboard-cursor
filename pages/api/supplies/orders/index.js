import { withAuth } from '../../../../lib/auth';
import { getSupplyOrders, createSupplyOrder } from '../../../../lib/suppliesDb';

export default async function handler(req, res) {
	await withAuth(req, res, async (session) => {
		if (req.method === 'GET') {
			return res.json({ data: await getSupplyOrders() });
		}
		if (req.method === 'POST') {
			const { items, location, notes } = req.body;
			if (!items?.length) return res.status(400).json({ error: 'items are required' });
			const order = await createSupplyOrder({
				items: items.map((item) => ({
					product_id: item.product_id,
					quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
					unit_price: parseFloat(item.unit_price) || 0,
					sales_tax_percent: parseFloat(item.sales_tax_percent) || 0,
				})),
				location: location?.trim() || 'Warehouse',
				notes: notes?.trim() || null,
				created_by: session?.user?.name || session?.user?.username || null,
			});
			return res.status(201).json({ data: order });
		}
		res.status(405).end();
	});
}
