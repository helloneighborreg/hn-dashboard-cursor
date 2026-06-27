import { withAuth } from '../../../lib/auth';
import { upsertPushSubscription, deletePushSubscriptionsForUsername } from '../../../lib/pushSubscriptionsDb';

function parseSubscription(body) {
	const endpoint = body?.endpoint?.trim();
	const p256dh = body?.keys?.p256dh?.trim();
	const auth = body?.keys?.auth?.trim();
	if (!endpoint || !p256dh || !auth) {
		const err = new Error('Invalid push subscription');
		err.status = 400;
		throw err;
	}
	return { endpoint, p256dh, auth };
}

export default async function handler(req, res) {
	await withAuth(req, res, async (session) => {
		if (req.method === 'POST') {
			try {
				const subscription = parseSubscription(req.body || {});
				const row = await upsertPushSubscription({
					username: session.user.username,
					endpoint: subscription.endpoint,
					p256dh: subscription.p256dh,
					auth: subscription.auth,
					userAgent: req.headers['user-agent'] || null,
				});
				return res.status(201).json({ ok: true, id: row.id });
			} catch (err) {
				const status = err.status || 500;
				return res.status(status).json({ error: err.message || 'Failed to save subscription' });
			}
		}

		if (req.method === 'DELETE') {
			try {
				const endpoint = req.body?.endpoint?.trim() || null;
				await deletePushSubscriptionsForUsername(session.user.username, endpoint);
				return res.json({ ok: true });
			} catch (err) {
				return res.status(500).json({ error: err.message || 'Failed to remove subscription' });
			}
		}

		res.setHeader('Allow', 'POST, DELETE');
		return res.status(405).json({ error: 'Method not allowed' });
	});
}
