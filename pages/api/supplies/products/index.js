import { withAuth } from '../../../../lib/auth';
import { effectiveTaxPercent, resolveProductSalePrice } from '../../../../lib/supplies';
import { getSupplyProducts, createSupplyProduct } from '../../../../lib/suppliesDb';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		if (req.method === 'GET') {
			const { category, search } = req.query;
			const filters = {};
			if (category) filters.category = category;
			if (search) filters.search = search;
			return res.json({ data: await getSupplyProducts(filters) });
		}
		if (req.method === 'POST') {
			const { title, category, image_url, cost, sales_tax_percent, sale_price } = req.body;
			if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
			const taxPercent = effectiveTaxPercent(sales_tax_percent, { isNewProduct: true });
			const product = await createSupplyProduct({
				id: uuidv4(),
				title: title.trim(),
				category: category?.trim() || 'General',
				image_url: image_url?.trim() || null,
				cost: parseFloat(cost) || 0,
				sales_tax_percent: taxPercent,
				sale_price: resolveProductSalePrice(
					{ cost, sales_tax_percent, sale_price },
					{ isNewProduct: true },
				),
			});
			return res.status(201).json({ data: product });
		}
		res.status(405).end();
	});
}
