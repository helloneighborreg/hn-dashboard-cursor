import { withAuth, getDashboardUsernames } from '../../../lib/auth';
import { getPushSubscriptionsForUsernames } from '../../../lib/pushSubscriptionsDb';
import { sendPushToUsernames } from '../../../lib/webPush';

const MAX_MESSAGE_LENGTH = 500;
const DEFAULT_TITLE = 'Hello Neighbor';

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		if (req.method !== 'POST') {
			res.setHeader('Allow', 'POST');
			return res.status(405).json({ error: 'Method not allowed' });
		}

		const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
		const message = String(body?.message || '').trim();
		const title = String(body?.title || DEFAULT_TITLE).trim() || DEFAULT_TITLE;

		if (!message) {
			return res.status(400).json({ error: 'Message is required' });
		}
		if (message.length > MAX_MESSAGE_LENGTH) {
			return res.status(400).json({ error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer` });
		}
		if (title.length > 120) {
			return res.status(400).json({ error: 'Title must be 120 characters or fewer' });
		}

		const usernames = getDashboardUsernames();
		if (!usernames.length) {
			return res.status(400).json({ error: 'No dashboard users configured' });
		}

		const subscriptions = await getPushSubscriptionsForUsernames(usernames);
		if (!subscriptions.length) {
			return res.status(400).json({
				error: 'No one has push notifications enabled yet. Ask users to open Settings and tap Enable notifications.',
			});
		}

		const result = await sendPushToUsernames(usernames, {
			title,
			body: message,
			url: '/',
		});

		if (result.skipped) {
			const status = result.reason === 'not_configured' ? 503 : 502;
			return res.status(status).json({
				error: result.reason === 'not_configured'
					? 'Push notifications are not configured on the server (VAPID keys missing).'
					: 'Push notification could not be delivered.',
			});
		}

		const usersWithSubscriptions = new Set(subscriptions.map((row) => row.username));

		return res.json({
			data: {
				sent: result.sent,
				user_count: usernames.length,
				users_notified: usersWithSubscriptions.size,
				device_count: subscriptions.length,
			},
		});
	}, { adminOnly: true });
}
