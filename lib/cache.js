const store = new Map();

/** Simple in-memory TTL cache for server-side API aggregation. */
export async function getCached(key, ttlMs, loader) {
	const now = Date.now();
	const hit = store.get(key);
	if (hit && now - hit.at < ttlMs) {
		return hit.value;
	}

	const value = await loader();
	store.set(key, { value, at: now });
	return value;
}

export function clearCache(prefix) {
	for (const key of store.keys()) {
		if (key.startsWith(prefix)) store.delete(key);
	}
}
