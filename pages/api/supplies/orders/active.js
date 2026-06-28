import { withAuth } from '../../../../lib/auth';
import { resolveDeliveryLocation } from '../../../../lib/supplies';
import { getActiveSupplyOrders, saveSupplyDraft } from '../../../../lib/suppliesDb';
import { filterHiddenPropertyRows, isHiddenPropertyId } from '../../../../lib/hiddenProperties';

export default async function handler(req, res) {
	await withAuth(req, res, async (session) => {
		if (req.method === 'GET') {
			return res.json({ data: filterHiddenPropertyRows(await getActiveSupplyOrders()) });
		}
		if (req.method === 'PUT') {
			const { order_id, items, location, notes, property_id, property_name, markup_percent } = req.body || {};
			if (isHiddenPropertyId(property_id?.trim())) {
				return res.status(404).json({ error: 'Property not found' });
			}
			const order = await saveSupplyDraft({
				order_id: order_id?.trim() || null,
				items: (items || []).map((item) => {
					const customTitle = item.custom_title?.trim() || null;
					return {
						product_id: customTitle ? null : item.product_id,
						custom_title: customTitle,
						quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
						unit_price: parseFloat(item.unit_price) || 0,
						sales_tax_percent: parseFloat(item.sales_tax_percent) || 0,
					};
				}),
				location: resolveDeliveryLocation(location, property_name),
				notes: notes?.trim() || null,
				property_id: property_id?.trim() || null,
				property_name: property_name?.trim() || null,
				markup_percent,
				created_by: session?.user?.name || session?.user?.username || null,
			});
			return res.json({ data: order });
		}
		res.status(405).end();
	});
}
