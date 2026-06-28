import { withAuth } from '../../../../lib/auth';
import { getBillpayInvoiceById } from '../../../../lib/billpayDb';
import { buildBillpayInvoicePdfBytes, billpayInvoicePdfFilename } from '../../../../lib/billpayInvoicePdf';
import { getSupabase } from '../../../../lib/supabase';
import { CHECKLIST_UPLOADS_BUCKET } from '../../../../lib/forms/checklistFormStorage';

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		const { id } = req.query;
		if (!id) return res.status(400).json({ error: 'Invoice id is required' });
		if (req.method !== 'GET') return res.status(405).end();

		try {
			const invoice = await getBillpayInvoiceById(id);
			if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

			let pdfBytes = null;
			if (invoice.pdf_storage_path) {
				const supabase = getSupabase();
				const { data, error } = await supabase.storage
					.from(CHECKLIST_UPLOADS_BUCKET)
					.download(invoice.pdf_storage_path);
				if (!error && data) {
					pdfBytes = await data.arrayBuffer();
				}
			}

			if (!pdfBytes) {
				pdfBytes = await buildBillpayInvoicePdfBytes(invoice);
			}

			const body = typeof Buffer !== 'undefined'
				? Buffer.from(pdfBytes)
				: new Uint8Array(pdfBytes);

			res.setHeader('Content-Type', 'application/pdf');
			res.setHeader('Content-Disposition', `inline; filename="${billpayInvoicePdfFilename(invoice)}"`);
			res.setHeader('Cache-Control', 'private, max-age=3600');
			res.status(200).send(body);
		} catch (err) {
			console.error('Billpay invoice PDF error:', err.message);
			res.status(502).json({ error: err.message });
		}
	}, { adminOnly: true });
}
