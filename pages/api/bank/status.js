import { withAuth } from '../../../lib/auth';
import { getBankConnection } from '../../../lib/db';
import { plaidConfigured } from '../../../lib/plaid';

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		if (req.method !== 'GET') return res.status(405).end();

		try {
			const connection = await getBankConnection();
			res.json({
				plaidConfigured: plaidConfigured(),
				linked: Boolean(connection?.access_token),
				institutionName: connection?.institution_name || null,
				accounts: connection?.accounts || [],
				lastSync: connection?.last_sync || null,
			});
		} catch (err) {
			console.error('Bank status error:', err.message);
			res.status(502).json({ error: err.message });
		}
	}, { adminOnly: true });
}
