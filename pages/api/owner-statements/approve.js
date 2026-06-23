import { withAuth } from '../../../lib/auth';
import { saveOwnerStatementApprovals } from '../../../lib/db';

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		if (req.method !== 'POST') return res.status(405).end();

		const { statements, date_from, date_to, pdfs } = req.body || {};
		if (!Array.isArray(statements) || !statements.length) {
			return res.status(400).json({ error: 'statements array is required.' });
		}

		const pdfsByPropertyId = {};
		if (Array.isArray(pdfs)) {
			for (const row of pdfs) {
				if (row?.property_id && row?.pdf_base64) {
					pdfsByPropertyId[row.property_id] = row.pdf_base64;
				}
			}
		} else if (pdfs && typeof pdfs === 'object') {
			for (const [propertyId, pdfBase64] of Object.entries(pdfs)) {
				if (pdfBase64) pdfsByPropertyId[propertyId] = pdfBase64;
			}
		}

		try {
			const data = await saveOwnerStatementApprovals(statements, {
				date_from,
				date_to,
				pdfsByPropertyId,
			});
			res.json({ data });
		} catch (err) {
			console.error('Owner statement approve error:', err.message);
			res.status(502).json({ error: err.message });
		}
	}, { adminOnly: true });
}
