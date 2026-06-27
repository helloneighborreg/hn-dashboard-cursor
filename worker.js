// Custom worker: re-use OpenNext fetch handler and add Cloudflare Cron support.
// Build first: npm run build:cloudflare
// @ts-ignore generated at build time
import handler from './.open-next/worker.js';

const SYNC_PATH = '/api/tasks/sync-cron';
const OVERDUE_NOTIFY_PATH = '/api/tasks/overdue-notify-cron';
const fetchHandler = typeof handler === 'function' ? handler : handler.fetch;

async function postCronPath(path, env, ctx, label) {
	const secret = env.CRON_SECRET;
	if (!secret) {
		console.error(`${label}: CRON_SECRET is not configured`);
		return;
	}

	const request = new Request(`https://team.stayhn.com${path}`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${secret}`,
			'x-cron-secret': secret,
			'x-triggered-by': 'cloudflare-cron',
		},
	});

	const response = await fetchHandler(request, env, ctx);
	const body = await response.text();
	if (!response.ok) {
		console.error(`${label} failed:`, response.status, body.slice(0, 500));
		return;
	}
	console.log(`${label} ok:`, body.slice(0, 500));
}

export default {
	fetch: fetchHandler,

	/**
	 * Cloudflare Cron Triggers — dispatch by schedule expression.
	 * Test locally: wrangler dev --test-scheduled
	 *   curl "http://localhost:8787/cdn-cgi/handler/scheduled"
	 */
	async scheduled(event, env, ctx) {
		switch (event.cron) {
			case '*/15 * * * *':
				return postCronPath(OVERDUE_NOTIFY_PATH, env, ctx, 'overdue notify cron');
			case '*/30 * * * *':
			default:
				return postCronPath(SYNC_PATH, env, ctx, 'tasks sync cron');
		}
	},
};

// Required for OpenNext queue / tag cache durable objects.
// @ts-ignore generated at build time
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from './.open-next/worker.js';
