import { getVapidPublicKey } from '../../../lib/webPush';

export default function handler(req, res) {
	if (req.method !== 'GET') {
		res.setHeader('Allow', 'GET');
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const publicKey = getVapidPublicKey();
	if (!publicKey) {
		return res.status(503).json({ error: 'Push notifications are not configured' });
	}

	return res.json({ publicKey });
}
