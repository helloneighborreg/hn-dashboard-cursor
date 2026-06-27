import webpush from 'web-push';
import {
	deletePushSubscriptionByEndpoint,
	getPushSubscriptionsForUsernames,
} from './pushSubscriptionsDb.js';

let configured = false;

function pushConfigured() {
	return Boolean(
		process.env.VAPID_PUBLIC_KEY?.trim()
		&& process.env.VAPID_PRIVATE_KEY?.trim(),
	);
}

function ensureConfigured() {
	if (configured || !pushConfigured()) return false;

	webpush.setVapidDetails(
		process.env.VAPID_SUBJECT?.trim() || 'mailto:admin@helloneighbor.com',
		process.env.VAPID_PUBLIC_KEY.trim(),
		process.env.VAPID_PRIVATE_KEY.trim(),
	);
	configured = true;
	return true;
}

export function getVapidPublicKey() {
	return process.env.VAPID_PUBLIC_KEY?.trim() || '';
}

export async function sendPushToSubscription(subscription, payload) {
	if (!ensureConfigured()) return { sent: false, reason: 'not_configured' };

	try {
		await webpush.sendNotification(
			{
				endpoint: subscription.endpoint,
				keys: {
					p256dh: subscription.p256dh,
					auth: subscription.auth,
				},
			},
			JSON.stringify(payload),
		);
		return { sent: true };
	} catch (err) {
		if (err?.statusCode === 404 || err?.statusCode === 410) {
			await deletePushSubscriptionByEndpoint(subscription.endpoint).catch(() => {});
			return { sent: false, reason: 'expired', removed: true };
		}
		console.warn('[web-push] send failed:', err?.message || err);
		return { sent: false, reason: 'delivery_failed' };
	}
}

export async function sendPushToUsernames(usernames, { title, body, url = '/' } = {}) {
	if (!ensureConfigured()) {
		return { sent: 0, skipped: true, reason: 'not_configured' };
	}

	const unique = [...new Set((usernames || []).filter(Boolean))];
	if (!unique.length) {
		return { sent: 0, skipped: true, reason: 'no_recipients' };
	}

	const subscriptions = await getPushSubscriptionsForUsernames(unique);
	if (!subscriptions.length) {
		return { sent: 0, skipped: true, reason: 'no_subscriptions' };
	}

	const payload = { title, body, url };
	let sent = 0;
	for (const subscription of subscriptions) {
		const result = await sendPushToSubscription(subscription, payload);
		if (result.sent) sent += 1;
	}

	return { sent, skipped: sent === 0, reason: sent === 0 ? 'delivery_failed' : null };
}
