import { withAuth } from '../../../../lib/auth';
import { saveBankConnection } from '../../../../lib/db';
import { exchangePlaidPublicToken, plaidConfigured } from '../../../../lib/plaid';

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		if (req.method !== 'POST') return res.status(405).end();

		if (!plaidConfigured()) {
			return res.status(503).json({ error: 'Plaid is not configured.' });
		}

		const publicToken = req.body?.publicToken;
		if (!publicToken) {
			return res.status(400).json({ error: 'publicToken is required.' });
		}

		try {
			const linked = await exchangePlaidPublicToken(publicToken);
			await saveBankConnection({
				accessToken: linked.accessToken,
				itemId: linked.itemId,
				institutionName: linked.institutionName,
				accounts: linked.accounts,
				cursor: null,
				lastSync: null,
			});

			res.json({
				linked: true,
				institutionName: linked.institutionName,
				accounts: linked.accounts,
			});
		} catch (err) {
			console.error('Plaid exchange error:', err.response?.data || err.message);
			res.status(502).json({
				error: err.response?.data?.error_message || err.message || 'Failed to link bank account',
			});
		}
	}, { adminOnly: true });
}
