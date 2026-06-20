import { withAuth } from '../../../../lib/auth';
import { updateBankTransactionsBulk } from '../../../../lib/db';

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		if (req.method !== 'PATCH') return res.status(405).end();

		const { ids, category, property_id, reviewed, hidden } = req.body || {};
		if (!Array.isArray(ids) || !ids.length) {
			return res.status(400).json({ error: 'ids array is required' });
		}

		try {
			const data = await updateBankTransactionsBulk(ids, {
				category,
				property_id,
				reviewed,
				hidden,
			});
			return res.json({ data, updated: data.length });
		} catch (err) {
			console.error('Bulk update bank transactions error:', err.message);
			return res.status(502).json({ error: err.message });
		}
	}, { adminOnly: true });
}
