const store = new Map();
const inflight = new Map();

/** Simple in-memory TTL cache for server-side API aggregation. */
export async function getCached(key, ttlMs, loader) {
	const now = Date.now();
	const hit = store.get(key);
	if (hit && now - hit.at < ttlMs) {
		return hit.value;
	}

	if (inflight.has(key)) {
		return inflight.get(key);
	}

	const pending = Promise.resolve()
		.then(loader)
		.then((value) => {
			store.set(key, { value, at: Date.now() });
			return value;
		})
		.finally(() => {
			inflight.delete(key);
		});

	inflight.set(key, pending);
	return pending;
}

export function clearCache(prefix) {
	for (const key of store.keys()) {
		if (key.startsWith(prefix)) store.delete(key);
	}
	for (const key of inflight.keys()) {
		if (key.startsWith(prefix)) inflight.delete(key);
	}
}
