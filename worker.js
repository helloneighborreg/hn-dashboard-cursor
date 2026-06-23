// Custom worker: re-use OpenNext fetch handler.
// Build first: npm run build:cloudflare
// @ts-ignore generated at build time
import handler from './.open-next/worker.js';

const fetchHandler = typeof handler === 'function' ? handler : handler.fetch;

export default {
	fetch: fetchHandler,
};

// Required for OpenNext queue / tag cache durable objects.
// @ts-ignore generated at build time
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from './.open-next/worker.js';
