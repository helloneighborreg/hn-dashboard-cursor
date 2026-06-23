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

	let res;
	try {
		res = await fetch(url, { ...fetchOptions, cache: 'no-store' });
	} catch (err) {
		const message = err?.message || '';
		if (/failed to fetch|networkerror|load failed/i.test(message)) {
			throw new Error('Could not reach the server. Check your connection and try again.');
		}
		throw err;
	}

	if (res.status === 401 && redirectOn401) {
		window.location.href = '/';
		return null;
	}

	const json = await res.json().catch(() => ({}));
	if (!res.ok) {
		if (res.status === 413) {
			throw new Error('Upload is too large. Close the tab, reopen the checklist from your task, and try again.');
		}
		if (res.status === 504 || res.status === 524) {
			throw new Error('The server timed out. Check your connection and try again.');
		}
		throw new Error(json.error || json.message || res.statusText || 'Request failed');
	}

	return json;
}
