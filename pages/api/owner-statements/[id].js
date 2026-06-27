import { withAuth } from '../../../lib/auth';
import { getOwnerStatementApproval, voidOwnerStatement } from '../../../lib/db';
import { rejectHiddenProperty } from '../../../lib/hiddenProperties';

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		const { id } = req.query;
		if (!id) return res.status(400).json({ error: 'Statement id is required.' });

		if (req.method === 'GET') {
			try {
				const row = await getOwnerStatementApproval(id);
				if (!row) return res.status(404).json({ error: 'Statement not found.' });
				if (rejectHiddenProperty(row.property_id, res)) return;

				res.json({
					data: {
						id: row.id,
						property_id: row.property_id,
						statement_period: row.statement_period,
						date_from: row.date_from,
						date_to: row.date_to,
						approved_at: row.approved_at,
						has_pdf: Boolean(row.pdf_storage_path),
						statement: row.statement_data || {},
					},
				});
			} catch (err) {
				console.error('Owner statement fetch error:', err.message);
				res.status(502).json({ error: err.message });
			}
			return;
		}

		if (req.method === 'DELETE') {
			try {
				const existing = await getOwnerStatementApproval(id);
				if (!existing) return res.status(404).json({ error: 'Statement not found.' });
				if (rejectHiddenProperty(existing.property_id, res)) return;

				const data = await voidOwnerStatement(id);
				res.json({ data });
			} catch (err) {
				console.error('Owner statement void error:', err.message);
				res.status(err.status || 502).json({ error: err.message });
			}
			return;
		}

		return res.status(405).end();
	}, { adminOnly: true });
}
