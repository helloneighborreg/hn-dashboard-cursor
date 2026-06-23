import { withAuth } from '../../../lib/auth';
import { setOwnerStatementCashInclusion } from '../../../lib/db';
import { statementMonthFromDate } from '../../../lib/ownerStatementReport';

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		if (req.method !== 'PUT' && req.method !== 'PATCH') return res.status(405).end();

		const {
			property_id,
			item_id,
			item_source,
			statement_month,
			date,
			included,
		} = req.body || {};

		if (!property_id || !item_id || !item_source) {
			return res.status(400).json({ error: 'property_id, item_id, and item_source are required.' });
		}

		const month = statement_month || statementMonthFromDate(date);
		if (!month) {
			return res.status(400).json({ error: 'statement_month or date is required.' });
		}

		try {
			const data = await setOwnerStatementCashInclusion({
				property_id: String(property_id).trim(),
				item_id: String(item_id).trim(),
				item_source: String(item_source).trim(),
				statement_month: month,
				included: included !== false,
			});
			res.json({
				data: data || {
					property_id,
					item_id,
					item_source,
					statement_month: month,
					included: false,
				},
			});
		} catch (err) {
			console.error('Owner statement cash inclusion error:', err.message);
			res.status(502).json({ error: err.message });
		}
	}, { adminOnly: true });
}
