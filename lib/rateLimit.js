/**
 * Minimal in-memory sliding-window rate limiter.
 *
 * Note: state lives in the current process/isolate. On Cloudflare Workers each isolate
 * keeps its own buckets, so this throttles per-isolate rather than globally — still
 * meaningful friction against brute force, but not a substitute for an edge/WAF rule
 * or a durable store if strict global limits are required.
 */

const buckets = new Map();

/**
 * @returns {{ allowed: boolean, remaining: number, retryAfterSec: number }}
 */
export function rateLimit(key, { limit = 5, windowMs = 60_000 } = {}) {
	const now = Date.now();
	const windowStart = now - windowMs;
	const hits = (buckets.get(key) || []).filter((ts) => ts > windowStart);

	if (hits.length >= limit) {
		const retryAfterSec = Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000));
		buckets.set(key, hits);
		return { allowed: false, remaining: 0, retryAfterSec };
	}

	hits.push(now);
	buckets.set(key, hits);

	// Opportunistic cleanup so the map doesn't grow unbounded across many keys.
	if (buckets.size > 5000) {
		for (const [k, v] of buckets) {
			if (!v.some((ts) => ts > windowStart)) buckets.delete(k);
		}
	}

	return { allowed: true, remaining: limit - hits.length, retryAfterSec: 0 };
}

/** Best-effort client IP from common proxy headers (Cloudflare sets cf-connecting-ip). */
export function getClientIp(req) {
	const cf = req.headers['cf-connecting-ip'];
	if (cf) return String(cf);
	const fwd = req.headers['x-forwarded-for'];
	if (fwd) return String(fwd).split(',')[0].trim();
	return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}
