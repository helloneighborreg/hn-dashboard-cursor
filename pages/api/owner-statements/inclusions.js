import { withAuth } from '../../../lib/auth';
import { setOwnerStatementInclusion } from '../../../lib/db';
import { assertCanEditOwnerStatementReservation } from '../../../lib/ownerStatementLock';
import { statementMonthFromCheckIn } from '../../../lib/ownerStatementReport';

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		if (req.method !== 'PUT' && req.method !== 'PATCH') return res.status(405).end();

		const {
			property_id,
			reservation_id,
			statement_month,
			check_in,
			included,
			admin_password,
		} = req.body || {};

		if (!property_id || !reservation_id) {
			return res.status(400).json({ error: 'property_id and reservation_id are required.' });
		}

		const month = statement_month || statementMonthFromCheckIn(check_in);
		if (!month) {
			return res.status(400).json({ error: 'statement_month or check_in is required.' });
		}

		try {
			await assertCanEditOwnerStatementReservation({
				property_id: String(property_id).trim(),
				reservation_id: String(reservation_id).trim(),
				admin_password,
			});

			const data = await setOwnerStatementInclusion({
				property_id: String(property_id).trim(),
				reservation_id: String(reservation_id).trim(),
				statement_month: month,
				included: included !== false,
			});
			res.json({ data: data || { property_id, reservation_id, statement_month: month, included: false } });
		} catch (err) {
			console.error('Owner statement inclusion error:', err.message);
			res.status(err.status || 502).json({ error: err.message });
		}
	}, { adminOnly: true });
}
