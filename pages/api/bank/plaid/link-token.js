import { withAuth } from '../../../../lib/auth';
import { createPlaidLinkToken, plaidConfigured } from '../../../../lib/plaid';

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		if (req.method !== 'POST') return res.status(405).end();

		if (!plaidConfigured()) {
			return res.status(503).json({
				error: 'Plaid is not configured. Add PLAID_CLIENT_ID and PLAID_SECRET to your environment.',
			});
		}

		try {
			const linkToken = await createPlaidLinkToken();
			res.json({ linkToken });
		} catch (err) {
			console.error('Plaid link token error:', err.response?.data || err.message);
			res.status(502).json({
				error: err.response?.data?.error_message || err.message || 'Failed to create Plaid link token',
			});
		}
	}, { adminOnly: true });
}
