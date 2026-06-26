export function isSameAppHref(href) {
	const value = String(href || '').trim();
	return value.startsWith('/') && !value.startsWith('//');
}

export function externalLinkProps(href) {
	if (isSameAppHref(href)) return {};
	return {
		target: '_blank',
		rel: 'noopener noreferrer',
	};
}
