// Custom worker: re-use OpenNext fetch handler and add Cloudflare Cron support.
// Build first: npm run build:cloudflare
// @ts-ignore generated at build time
import handler from './.open-next/worker.js';

const SYNC_PATH = '/api/tasks/sync-cron';
const fetchHandler = typeof handler === 'function' ? handler : handler.fetch;

export default {
	fetch: fetchHandler,

	/**
	 * Cloudflare Cron Trigger — sync turnover tasks from Hospitable.
	 * Test locally: wrangler dev --test-scheduled
	 *   curl "http://localhost:8787/cdn-cgi/handler/scheduled"
	 */
	async scheduled(_event, env, ctx) {
		const secret = env.CRON_SECRET;
		if (!secret) {
			console.error('tasks sync cron: CRON_SECRET is not configured');
			return;
		}

		const request = new Request(`https://team.stayhn.com${SYNC_PATH}`, {
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
			console.error('tasks sync cron failed:', response.status, body.slice(0, 500));
			return;
		}
		console.log('tasks sync cron ok:', body.slice(0, 500));
	},
};

// Required for OpenNext queue / tag cache durable objects.
// @ts-ignore generated at build time
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from './.open-next/worker.js';
