import { withAuth } from '../../../lib/auth';
import { disconnectBankConnection } from '../../../lib/db';
import { removePlaidItem } from '../../../lib/plaid';

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		if (req.method !== 'POST') return res.status(405).end();

		const deleteTransactions = Boolean(req.body?.deleteTransactions);

		try {
			const { hadConnection, accessToken } = await disconnectBankConnection({ deleteTransactions });

			if (accessToken) {
				try {
					await removePlaidItem(accessToken);
				} catch (err) {
					console.warn('Plaid itemRemove failed (connection cleared locally):', err.message);
				}
			}

			res.json({
				disconnected: true,
				hadConnection,
				deletedTransactions: deleteTransactions,
			});
		} catch (err) {
			console.error('Bank disconnect error:', err.message);
			res.status(502).json({ error: err.message });
		}
	}, { adminOnly: true });
}
