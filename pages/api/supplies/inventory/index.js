import { withAuth } from '../../../../lib/auth';
import { getSupplyInventory, upsertSupplyInventory } from '../../../../lib/suppliesDb';

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		if (req.method === 'GET') {
			const { location, product_id } = req.query;
			const filters = {};
			if (location) filters.location = location;
			if (product_id) filters.product_id = product_id;
			return res.json({ data: await getSupplyInventory(filters) });
		}
		if (req.method === 'POST') {
			const { product_id, location, quantity } = req.body;
			if (!product_id || quantity == null) {
				return res.status(400).json({ error: 'product_id and quantity are required' });
			}
			const row = await upsertSupplyInventory({
				product_id,
				location: location?.trim() || 'Warehouse',
				quantity: Math.max(0, parseInt(quantity, 10) || 0),
			});
			return res.status(201).json({ data: row });
		}
		res.status(405).end();
	}, { adminOnly: true });
}
