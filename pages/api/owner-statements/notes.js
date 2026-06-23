import { withAuth } from '../../../lib/auth';
import { upsertOwnerStatementNotes } from '../../../lib/db';
import { assertCanEditOwnerStatementReservation } from '../../../lib/ownerStatementLock';

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		if (req.method !== 'PUT' && req.method !== 'PATCH') return res.status(405).end();

		const { property_id, reservation_id, notes, admin_password } = req.body || {};

		if (!property_id || !reservation_id) {
			return res.status(400).json({ error: 'property_id and reservation_id are required.' });
		}

		try {
			await assertCanEditOwnerStatementReservation({
				property_id: String(property_id).trim(),
				reservation_id: String(reservation_id).trim(),
				admin_password,
			});

			const data = await upsertOwnerStatementNotes({
				property_id: String(property_id).trim(),
				reservation_id: String(reservation_id).trim(),
				notes: notes == null ? '' : String(notes),
			});
			res.json({ data });
		} catch (err) {
			console.error('Owner statement notes error:', err.message);
			res.status(err.status || 502).json({ error: err.message });
		}
	}, { adminOnly: true });
}
