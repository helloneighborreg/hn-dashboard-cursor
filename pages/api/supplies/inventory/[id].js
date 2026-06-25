import { withAuth } from '../../../../lib/auth';
import {
	deleteSupplyInventory,
	getSupplyInventoryById,
	updateSupplyInventory,
	updateSupplyProduct,
} from '../../../../lib/suppliesDb';

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		const { id } = req.query;

		if (req.method === 'GET') {
			const row = await getSupplyInventoryById(id);
			if (!row) return res.status(404).json({ error: 'Not found' });
			return res.json({ data: row });
		}

		if (req.method === 'PATCH') {
			const row = await getSupplyInventoryById(id);
			if (!row) return res.status(404).json({ error: 'Not found' });
			const { product_id, location, quantity, image_url, title } = req.body;
			const patch = {};
			if (product_id !== undefined) patch.product_id = product_id;
			if (location !== undefined) patch.location = location;
			if (quantity !== undefined) patch.quantity = quantity;
			const updated = Object.keys(patch).length
				? await updateSupplyInventory(id, patch)
				: row;

			const productPatch = {};
			if (title !== undefined) productPatch.title = title.trim();
			if (image_url !== undefined) productPatch.image_url = image_url?.trim() || null;
			if (Object.keys(productPatch).length) {
				await updateSupplyProduct(row.product_id, productPatch);
			}

			if (Object.keys(productPatch).length) {
				const refreshed = await getSupplyInventoryById(id);
				return res.json({ data: refreshed });
			}
			return res.json({ data: updated });
		}

		if (req.method === 'DELETE') {
			if (!(await getSupplyInventoryById(id))) {
				return res.status(404).json({ error: 'Not found' });
			}
			await deleteSupplyInventory(id);
			return res.json({ ok: true });
		}

		res.status(405).end();
	}, { adminOnly: true });
}
