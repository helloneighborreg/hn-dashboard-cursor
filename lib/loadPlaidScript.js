/** Lazy-load the Plaid Link script once; resolves true when window.Plaid is available. */
export function loadPlaidScript() {
	if (typeof window === 'undefined') return Promise.resolve(false);
	if (window.Plaid) return Promise.resolve(true);

	return new Promise((resolve, reject) => {
		const existing = document.querySelector('script[data-plaid-link]');
		if (existing) {
			existing.addEventListener('load', () => resolve(true));
			existing.addEventListener('error', reject);
			return;
		}

		const script = document.createElement('script');
		script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
		script.async = true;
		script.dataset.plaidLink = 'true';
		script.onload = () => resolve(true);
		script.onerror = reject;
		document.body.appendChild(script);
	});
}
