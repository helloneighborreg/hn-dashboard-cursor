import { v4 as uuidv4 } from 'uuid';
import { withAuth } from '../../../../lib/auth';
import { INVENTORY_ONLY_CATEGORY } from '../../../../lib/supplies';
import { createSupplyProduct, getSupplyInventory, upsertSupplyInventory } from '../../../../lib/suppliesDb';

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
			const { product_id, title, location, quantity, image_url } = req.body;
			if (quantity == null) {
				return res.status(400).json({ error: 'quantity is required' });
			}

			let resolvedProductId = product_id;
			if (!resolvedProductId) {
				const trimmedTitle = title?.trim();
				if (!trimmedTitle) {
					return res.status(400).json({ error: 'Select a product or enter a custom item name' });
				}
				const product = await createSupplyProduct({
					id: uuidv4(),
					title: trimmedTitle,
					category: INVENTORY_ONLY_CATEGORY,
					image_url: image_url?.trim() || null,
					cost: 0,
					sales_tax_percent: 0,
					sale_price: 0,
				});
				resolvedProductId = product.id;
			}

			const row = await upsertSupplyInventory({
				product_id: resolvedProductId,
				location: location?.trim() || 'Warehouse',
				quantity: Math.max(0, parseInt(quantity, 10) || 0),
			});
			return res.status(201).json({ data: row });
		}
		res.status(405).end();
	}, req.method !== 'GET' ? { adminOnly: true } : {});
}
