import { withAuth } from '../../../../../lib/auth';
import { getSupplyOrderById } from '../../../../../lib/suppliesDb';
import { buildSupplyInvoicePdfBytes, supplyInvoicePdfFilename } from '../../../../../lib/supplyInvoicePdf';
import { getProperty } from '../../../../../lib/hospitable';

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		const { id } = req.query;
		if (!id) return res.status(400).json({ error: 'Order id is required' });
		if (req.method !== 'GET') return res.status(405).end();

		try {
			const order = await getSupplyOrderById(id);
			if (!order) return res.status(404).json({ error: 'Order not found' });

			let property = null;
			if (order.property_id) {
				try {
					property = await getProperty(order.property_id);
				} catch {
					// fall back to stored property_name only
				}
			}

			const pdfBytes = await buildSupplyInvoicePdfBytes(order, { property });
			const body = typeof Buffer !== 'undefined'
				? Buffer.from(pdfBytes)
				: new Uint8Array(pdfBytes);

			res.setHeader('Content-Type', 'application/pdf');
			res.setHeader('Content-Disposition', `inline; filename="${supplyInvoicePdfFilename(order)}"`);
			res.setHeader('Cache-Control', 'private, max-age=3600');
			res.status(200).send(body);
		} catch (err) {
			console.error('Supply invoice PDF error:', err.message);
			res.status(502).json({ error: err.message });
		}
	});
}
