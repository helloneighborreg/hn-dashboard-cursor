import { withAuth, verifyAdminPassword } from '../../../lib/auth';

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		if (req.method !== 'POST') return res.status(405).end();

		const { password } = req.body || {};
		const ok = await verifyAdminPassword(password);
		if (!ok) {
			return res.status(403).json({ error: 'Incorrect admin password.' });
		}
		res.json({ ok: true });
	}, { adminOnly: true });
}
