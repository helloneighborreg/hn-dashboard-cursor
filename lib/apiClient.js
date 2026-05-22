/**
 * Browser fetch helper with JSON parsing and optional 401 redirect.
 */
export async function fetchJson(url, options = {}) {
	const { redirectOn401 = true, ...init } = options;
	const res = await fetch(url, init);

	if (res.status === 401 && redirectOn401) {
		window.location.href = '/';
		return null;
	}

	const json = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw new Error(json.error || res.statusText || 'Request failed');
	}

	return json;
}
