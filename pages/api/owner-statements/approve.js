import { withAuth } from '../../../lib/auth';
import { getOwnerStatementApprovalsForProperties, saveOwnerStatementApprovals } from '../../../lib/db';
import {
	buildStatementLockMaps,
	isStatementCashItemLocked,
} from '../../../lib/ownerStatementReport';

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
			const propertyIds = [...new Set(statements.map((s) => s.property_id).filter(Boolean))];
			const existingApprovals = await getOwnerStatementApprovalsForProperties(propertyIds);
			const { reservationLocks, cashLocks } = buildStatementLockMaps({ approvals: existingApprovals });

			for (const statement of statements) {
				const property_id = statement.property_id;
				for (const row of statement.reservations || []) {
					if (reservationLocks.has(`${property_id}:${row.id}`)) {
						return res.status(409).json({
							error: `Reservation ${row.code || row.id} is already on an approved owner statement.`,
						});
					}
				}
				for (const tx of statement.transactions || []) {
					if (isStatementCashItemLocked({ ...tx, property_id }, cashLocks)) {
						return res.status(409).json({
							error: 'One or more transactions are already on an approved owner statement.',
						});
					}
				}
				for (const adj of statement.adjustments || []) {
					if (isStatementCashItemLocked({ ...adj, property_id, kind: 'adjustment' }, cashLocks)) {
						return res.status(409).json({
							error: 'One or more adjustments are already on an approved owner statement.',
						});
					}
				}
			}

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
