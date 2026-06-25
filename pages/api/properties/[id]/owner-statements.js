import { withAuth } from '../../../../lib/auth';
import { getPropertyOwnerStatementApprovals } from '../../../../lib/db';

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		const { id: propertyId } = req.query;
		if (!propertyId) return res.status(400).json({ error: 'Property id is required.' });

		if (req.method !== 'GET') return res.status(405).end();

		try {
			const rows = await getPropertyOwnerStatementApprovals(propertyId);
			const data = rows.map((row) => ({
				id: row.id,
				property_id: row.property_id,
				statement_period: row.statement_period,
				date_from: row.date_from,
				date_to: row.date_to,
				reservation_count: row.reservation_ids?.length || 0,
				total_due_to_owner: row.statement_data?.totals?.total_due_to_owner || 0,
				has_pdf: Boolean(row.pdf_storage_path),
				approved_at: row.approved_at,
			}));
			res.json({ data });
		} catch (err) {
			console.error('Property owner statements list error:', err.message);
			res.status(502).json({ error: err.message });
		}
	});
}
