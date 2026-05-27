import { withAuth } from '../../../../lib/auth';
import { getBankTransactions } from '../../../../lib/db';

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		if (req.method !== 'GET') return res.status(405).end();

		const { date_from, date_to, account_id } = req.query;

		try {
			const data = await getBankTransactions({
				date_from,
				date_to,
				account_id,
			});
			res.json({ data });
		} catch (err) {
			console.error('Bank transactions error:', err.message);
			res.status(502).json({ error: err.message });
		}
	}, { adminOnly: true });
}
