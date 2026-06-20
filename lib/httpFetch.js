/**
 * Resilient fetch helpers for outbound API calls.
 *
 * - `fetchWithTimeout` aborts a request that hangs past `timeoutMs`. Use for
 *   non-idempotent calls (POST sends) where retrying could duplicate side effects.
 * - `fetchWithRetry` adds bounded retries with backoff for transient failures
 *   (network errors, timeouts, 429, 5xx). Use for idempotent reads (GET).
 */

const DEFAULT_TIMEOUT_MS = 15000;

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(url, { ...options, signal: controller.signal });
	} catch (err) {
		if (err?.name === 'AbortError') {
			throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
		}
		throw err;
	} finally {
		clearTimeout(timer);
	}
}

export async function fetchWithRetry(
	url,
	options = {},
	{ timeoutMs = DEFAULT_TIMEOUT_MS, retries = 2, retryDelayMs = 400 } = {},
) {
	let lastErr;
	for (let attempt = 0; attempt <= retries; attempt += 1) {
		try {
			const res = await fetchWithTimeout(url, options, timeoutMs);
			// Retry transient upstream failures, then surface the last response to the caller.
			if ((res.status === 429 || res.status >= 500) && attempt < retries) {
				await delay(retryDelayMs * (attempt + 1));
				continue;
			}
			return res;
		} catch (err) {
			lastErr = err;
			if (attempt < retries) {
				await delay(retryDelayMs * (attempt + 1));
				continue;
			}
			throw err;
		}
	}
	throw lastErr;
}
