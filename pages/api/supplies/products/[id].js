import { withAuth } from '../../../../lib/auth';
import { effectiveTaxPercent, resolveProductSalePrice } from '../../../../lib/supplies';
import { deleteSupplyProduct, getSupplyProductById, updateSupplyProduct } from '../../../../lib/suppliesDb';

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		const { id } = req.query;
		if (req.method === 'GET') {
			const product = await getSupplyProductById(id);
			if (!product) return res.status(404).json({ error: 'Not found' });
			return res.json({ data: product });
		}
		if (req.method === 'PATCH') {
			if (!(await getSupplyProductById(id))) return res.status(404).json({ error: 'Not found' });
			const { title, category, image_url, cost, sales_tax_percent, sale_price } = req.body;
			const patch = {};
			if (title !== undefined) patch.title = title.trim();
			if (category !== undefined) patch.category = category.trim() || 'General';
			if (image_url !== undefined) patch.image_url = image_url?.trim() || null;
			if (cost !== undefined) patch.cost = parseFloat(cost) || 0;
			if (sales_tax_percent !== undefined) {
				patch.sales_tax_percent = effectiveTaxPercent(sales_tax_percent, { isNewProduct: false });
			}
			if (sale_price !== undefined || cost !== undefined || sales_tax_percent !== undefined) {
				const existing = await getSupplyProductById(id);
				patch.sale_price = resolveProductSalePrice(
					{
						cost: patch.cost ?? existing.cost,
						sales_tax_percent: patch.sales_tax_percent ?? existing.sales_tax_percent,
						sale_price: sale_price ?? existing.sale_price,
					},
					{ isNewProduct: false },
				);
			}
			const updated = await updateSupplyProduct(id, patch);
			return res.json({ data: updated });
		}
		if (req.method === 'DELETE') {
			if (!(await getSupplyProductById(id))) return res.status(404).json({ error: 'Not found' });
			await deleteSupplyProduct(id);
			return res.json({ ok: true });
		}
		res.status(405).end();
	});
}
