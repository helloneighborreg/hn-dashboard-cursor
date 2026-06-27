import { useCallback, useEffect, useState } from 'react';
import { fetchJson } from './apiClient';

function isStandalone() {
	return (
		typeof window !== 'undefined' &&
		(window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true)
	);
}

function isIos() {
	return typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function activateWaitingWorker(worker) {
	worker?.postMessage({ type: 'SKIP_WAITING' });
}

function watchForUpdates(registration, onUpdateAvailable) {
	if (registration.waiting && navigator.serviceWorker.controller) {
		onUpdateAvailable(() => activateWaitingWorker(registration.waiting));
		return;
	}

	const worker = registration.installing;
	if (!worker) return;

	worker.addEventListener('statechange', () => {
		if (worker.state !== 'installed') return;

		if (navigator.serviceWorker.controller) {
			onUpdateAvailable(() => activateWaitingWorker(registration.waiting));
		} else {
			activateWaitingWorker(worker);
		}
	});
}

export function registerServiceWorker({ onUpdateAvailable } = {}) {
	if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

	let refreshing = false;

	navigator.serviceWorker.addEventListener('controllerchange', () => {
		if (refreshing) return;
		refreshing = true;
		window.location.reload();
	});

	function register() {
		navigator.serviceWorker
			.register('/sw.js')
			.then((registration) => {
				watchForUpdates(registration, onUpdateAvailable || (() => {}));

				registration.addEventListener('updatefound', () => {
					watchForUpdates(registration, onUpdateAvailable || (() => {}));
				});

				registration.update().catch(() => {});
			})
			.catch((err) => {
				console.warn('[pwa] Service worker registration failed:', err);
			});
	}

	if (document.readyState === 'complete') {
		register();
	} else {
		window.addEventListener('load', register, { once: true });
	}
}

export function usePwaInstall() {
	const [canInstall, setCanInstall] = useState(false);
	const [showIosHint, setShowIosHint] = useState(false);
	const [isInstalled, setIsInstalled] = useState(false);
	const [installPrompt, setInstallPrompt] = useState(null);

	useEffect(() => {
		if (isStandalone()) {
			setIsInstalled(true);
			return;
		}

		if (isIos()) {
			setShowIosHint(true);
		}

		function onBeforeInstallPrompt(event) {
			event.preventDefault();
			setInstallPrompt(event);
			setCanInstall(true);
			setShowIosHint(false);
		}

		function onAppInstalled() {
			setCanInstall(false);
			setIsInstalled(true);
			setInstallPrompt(null);
			setShowIosHint(false);
		}

		window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
		window.addEventListener('appinstalled', onAppInstalled);

		return () => {
			window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
			window.removeEventListener('appinstalled', onAppInstalled);
		};
	}, []);

	const install = useCallback(async () => {
		if (!installPrompt) return;
		await installPrompt.prompt();
		const { outcome } = await installPrompt.userChoice;
		setInstallPrompt(null);
		setCanInstall(false);
		if (outcome === 'accepted') {
			setIsInstalled(true);
		}
	}, [installPrompt]);

	return { canInstall, showIosHint, isInstalled, install };
}

function urlBase64ToUint8Array(base64String) {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const raw = window.atob(base64);
	return Uint8Array.from([...raw], (char) => char.charCodeAt(0));
}

function pushSupported() {
	return (
		typeof window !== 'undefined'
		&& 'serviceWorker' in navigator
		&& 'PushManager' in window
		&& 'Notification' in window
	);
}

async function getServiceWorkerRegistration() {
	const existing = await navigator.serviceWorker.getRegistration('/');
	return existing || navigator.serviceWorker.register('/sw.js');
}

export async function subscribeToPushNotifications() {
	if (!pushSupported()) {
		throw new Error('Push notifications are not supported in this browser');
	}

	const permission = await Notification.requestPermission();
	if (permission !== 'granted') {
		throw new Error('Notification permission denied');
	}

	const { publicKey } = await fetchJson('/api/push/public-key');
	if (!publicKey) {
		throw new Error('Push notifications are not configured on the server');
	}

	const registration = await getServiceWorkerRegistration();
	const subscription = await registration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: urlBase64ToUint8Array(publicKey),
	});

	await fetchJson('/api/push/subscribe', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(subscription.toJSON()),
	});

	return subscription;
}

export async function unsubscribeFromPushNotifications() {
	if (!pushSupported()) return;

	const registration = await navigator.serviceWorker.getRegistration('/');
	const subscription = await registration?.pushManager.getSubscription();
	if (!subscription) return;

	await fetchJson('/api/push/subscribe', {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ endpoint: subscription.endpoint }),
	});
	await subscription.unsubscribe();
}

export function usePushNotifications() {
	const [supported, setSupported] = useState(false);
	const [subscribed, setSubscribed] = useState(false);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	useEffect(() => {
		if (!pushSupported()) {
			setLoading(false);
			return;
		}

		setSupported(true);

		let cancelled = false;

		(async () => {
			try {
				const registration = await navigator.serviceWorker.getRegistration('/');
				const subscription = await registration?.pushManager.getSubscription();
				if (!cancelled) setSubscribed(Boolean(subscription));
			} catch {
				if (!cancelled) setSubscribed(false);
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, []);

	const subscribe = useCallback(async () => {
		setError('');
		setLoading(true);
		try {
			await subscribeToPushNotifications();
			setSubscribed(true);
		} catch (err) {
			setError(err.message || 'Failed to enable notifications');
			throw err;
		} finally {
			setLoading(false);
		}
	}, []);

	const unsubscribe = useCallback(async () => {
		setError('');
		setLoading(true);
		try {
			await unsubscribeFromPushNotifications();
			setSubscribed(false);
		} catch (err) {
			setError(err.message || 'Failed to disable notifications');
			throw err;
		} finally {
			setLoading(false);
		}
	}, []);

	return { supported, subscribed, loading, error, subscribe, unsubscribe };
}
