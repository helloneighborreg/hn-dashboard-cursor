import { withAuth } from '../../../lib/auth';
import { getBankConnection, saveBankConnection, upsertBankTransactions } from '../../../lib/db';
import { plaidConfigured, syncPlaidTransactions } from '../../../lib/plaid';

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		if (req.method !== 'POST') return res.status(405).end();

		if (!plaidConfigured()) {
			return res.status(503).json({ error: 'Plaid is not configured.' });
		}

		try {
			const connection = await getBankConnection();
			if (!connection?.access_token) {
				return res.status(400).json({
					error: 'No bank account linked. Connect your bank using Plaid first.',
				});
			}

			const { transactions, cursor } = await syncPlaidTransactions(
				connection.access_token,
				connection.cursor,
			);

			await upsertBankTransactions(transactions);

			const syncedAt = new Date().toISOString();
			await saveBankConnection({
				accessToken: connection.access_token,
				itemId: connection.item_id,
				institutionName: connection.institution_name,
				accounts: connection.accounts || [],
				cursor,
				lastSync: syncedAt,
			});

			res.json({
				syncedAt,
				stats: { transactions: transactions.length },
			});
		} catch (err) {
			console.error('Bank sync error:', err.response?.data || err.message);
			res.status(502).json({
				error: err.response?.data?.error_message || err.message || 'Failed to sync bank transactions',
			});
		}
	}, { adminOnly: true });
}
