import { withAuth } from '../../../../lib/auth';
import { downloadOwnerStatementPdf, getOwnerStatementApproval } from '../../../../lib/db';
import { ownerStatementPdfFilename } from '../../../../lib/ownerStatementReport';

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		const { id } = req.query;
		if (!id) return res.status(400).json({ error: 'Statement id is required.' });

		if (req.method !== 'GET') return res.status(405).end();

		try {
			const row = await getOwnerStatementApproval(id);
			if (!row) return res.status(404).json({ error: 'Statement not found.' });
			if (!row.pdf_storage_path) {
				return res.status(404).json({ error: 'PDF has not been generated for this statement.' });
			}

			const blob = await downloadOwnerStatementPdf(row.pdf_storage_path);
			const arrayBuffer = await blob.arrayBuffer();
			const body = typeof Buffer !== 'undefined'
				? Buffer.from(arrayBuffer)
				: new Uint8Array(arrayBuffer);

			res.setHeader('Content-Type', 'application/pdf');
			res.setHeader('Content-Disposition', `inline; filename="${ownerStatementPdfFilename(row)}"`);
			res.setHeader('Cache-Control', 'private, max-age=3600');
			res.status(200).send(body);
		} catch (err) {
			console.error('Owner statement PDF error:', err.message);
			res.status(502).json({ error: err.message });
		}
	}, { adminOnly: true });
}
