const CACHE = 'hn-static-v3';

const PRECACHE_URLS = [
	'/offline.html',
	'/manifest.webmanifest',
	'/favicon-32x32.png',
	'/apple-touch-icon.png',
	'/logo-icon-192.png',
	'/logo-icon-192-maskable.png',
	'/logo-icon-512.png',
	'/logo-icon-32.png',
];

function isStaticAsset(pathname) {
	return (
		pathname.startsWith('/_next/static/') ||
		/\.(?:png|ico|webmanifest|css|woff2?)$/i.test(pathname)
	);
}

function isNavigationRequest(request) {
	return (
		request.mode === 'navigate'
		|| (request.headers.get('accept') || '').includes('text/html')
	);
}

async function cacheFirst(request) {
	const cache = await caches.open(CACHE);
	const cached = await cache.match(request);
	if (cached) return cached;

	const response = await fetch(request);
	if (response.ok) {
		cache.put(request, response.clone());
	}
	return response;
}

async function networkFirstWithOfflineFallback(request) {
	try {
		const response = await fetch(request);
		if (response.ok || response.type === 'opaqueredirect') return response;
	} catch {
		// fall through to offline page
	}

	const cache = await caches.open(CACHE);
	const offline = await cache.match('/offline.html');
	if (offline) return offline;

	return new Response('Offline', {
		status: 503,
		headers: { 'Content-Type': 'text/plain' },
	});
}

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(PRECACHE_URLS))
			.then(() => self.skipWaiting()),
	);
});

self.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') {
		self.skipWaiting();
	}
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
		).then(() => self.clients.claim()),
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;
	if (url.pathname.startsWith('/api/')) return;

	if (isNavigationRequest(request)) {
		event.respondWith(networkFirstWithOfflineFallback(request));
		return;
	}

	if (isStaticAsset(url.pathname)) {
		event.respondWith(cacheFirst(request));
	}
});

self.addEventListener('push', (event) => {
	let payload = { title: 'Hello Neighbor', body: 'You have a new notification.', url: '/' };
	try {
		if (event.data) {
			payload = { ...payload, ...event.data.json() };
		}
	} catch {
		payload.body = event.data?.text() || payload.body;
	}

	event.waitUntil(
		self.registration.showNotification(payload.title, {
			body: payload.body,
			icon: '/logo-icon-192.png',
			badge: '/logo-icon-192.png',
			data: { url: payload.url || '/' },
		}),
	);
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = event.notification.data?.url || '/';

	event.waitUntil(
		clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
			for (const client of windowClients) {
				if (!client.url.startsWith(self.location.origin)) continue;
				if ('navigate' in client) {
					return client.navigate(url).then(() => client.focus());
				}
				client.focus();
				return undefined;
			}
			return clients.openWindow(url);
		}),
	);
});
