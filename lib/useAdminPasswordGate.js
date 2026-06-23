import { useCallback, useRef, useState } from 'react';
import { fetchJson } from './apiClient';

export function useAdminPasswordGate() {
	const [prompt, setPrompt] = useState(null);
	const cachedPassword = useRef(null);

	const verifyPassword = useCallback(async (password) => {
		await fetchJson('/api/auth/verify-admin-password', {
			method: 'POST',
			body: { password },
		});
		cachedPassword.current = password;
		return password;
	}, []);

	const requestPassword = useCallback((options = {}) => new Promise((resolve, reject) => {
		if (cachedPassword.current) {
			resolve(cachedPassword.current);
			return;
		}

		setPrompt({
			title: options.title,
			description: options.description,
			resolve,
			reject,
		});
	}), []);

	const closePrompt = useCallback(() => {
		setPrompt((current) => {
			current?.reject?.(new Error('Cancelled'));
			return null;
		});
	}, []);

	const submitPrompt = useCallback(async (password) => {
		if (!prompt) return;
		setPrompt((current) => ({ ...current, submitting: true, error: '' }));
		try {
			await verifyPassword(password);
			const resolve = prompt.resolve;
			setPrompt(null);
			resolve(password);
		} catch (err) {
			setPrompt((current) => (current ? {
				...current,
				submitting: false,
				error: err.message || 'Incorrect admin password.',
			} : null));
		}
	}, [prompt, verifyPassword]);

	const withAdminPassword = useCallback(async (action, options = {}) => {
		const password = await requestPassword(options);
		return action(password);
	}, [requestPassword]);

	return {
		prompt,
		closePrompt,
		submitPrompt,
		withAdminPassword,
		getCachedPassword: () => cachedPassword.current,
	};
}
