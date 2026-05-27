/**
 * Browser fetch helper with JSON parsing and optional 401 redirect.
 */
export async function fetchJson(url, options = {}) {
	const { redirectOn401 = true, body, ...init } = options;
	const fetchOptions = { ...init };

	if (body !== undefined) {
		fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
		fetchOptions.headers = {
			'Content-Type': 'application/json',
			...(init.headers || {}),
		};
	}

	const res = await fetch(url, { ...fetchOptions, cache: 'no-store' });

	if (res.status === 401 && redirectOn401) {
		window.location.href = '/';
		return null;
	}

	const json = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw new Error(json.error || json.message || res.statusText || 'Request failed');
	}

	return json;
}
