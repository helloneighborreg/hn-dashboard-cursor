#!/usr/bin/env node
/**
 * Send a test web push to a dashboard user who has enabled notifications.
 *
 * Usage:
 *   node scripts/send-test-push.mjs [username]
 *
 * Examples:
 *   node scripts/send-test-push.mjs josiah
 *   node scripts/send-test-push.mjs brandi
 *
 * Prerequisites:
 *   - VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY in env.local (or Cloudflare for prod-only sends)
 *   - User has clicked "Enable notifications" in the app at least once
 */

import { loadEnvFiles } from './load-env.mjs';

loadEnvFiles();

const { sendPushToUsernames } = await import('../lib/webPush.js');
const { getPushSubscriptionsForUsername } = await import('../lib/pushSubscriptionsDb.js');

function defaultUsername() {
	const raw = process.env.DASHBOARD_USERS?.trim();
	if (!raw) return '';
	try {
		const users = JSON.parse(raw);
		const admin = users.find((u) => String(u.role).toLowerCase() === 'admin');
		return String(admin?.username || users[0]?.username || '').trim();
	} catch {
		return '';
	}
}

const username = (process.argv[2] || defaultUsername()).trim();

if (!username) {
	console.error('Usage: node scripts/send-test-push.mjs [username]');
	console.error('No username given and no admin found in DASHBOARD_USERS.');
	process.exit(1);
}

if (!process.env.VAPID_PUBLIC_KEY?.trim() || !process.env.VAPID_PRIVATE_KEY?.trim()) {
	console.error('Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY in env.local');
	process.exit(1);
}

const subscriptions = await getPushSubscriptionsForUsername(username);
if (!subscriptions.length) {
	console.error(`No push subscription for "${username}".`);
	console.error('Open the dashboard, click Enable notifications, then run this again.');
	process.exit(1);
}

const result = await sendPushToUsernames([username], {
	title: 'Hello Neighbor — test notification',
	body: `Test push for ${username} at ${new Date().toLocaleString()}`,
	url: '/settings',
});

if (result.sent > 0) {
	console.log(`Sent test push to ${username} (${result.sent} device${result.sent === 1 ? '' : 's'})`);
	process.exit(0);
}

console.error(`Push not delivered (${result.reason || 'unknown'}).`);
process.exit(1);
