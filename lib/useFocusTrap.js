import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
	'a[href]',
	'button:not([disabled])',
	'textarea:not([disabled])',
	'input:not([disabled])',
	'select:not([disabled])',
	'[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Traps keyboard focus within a modal/drawer while it is open.
 * - Moves focus into the container on open (first focusable, else the container).
 * - Keeps Tab/Shift+Tab cycling inside the container.
 * - Restores focus to the previously focused element on close.
 *
 * Returns a ref to attach to the dialog container (give it tabIndex={-1}).
 */
export function useFocusTrap(active = true) {
	const ref = useRef(null);

	useEffect(() => {
		if (!active) return undefined;
		const container = ref.current;
		if (!container) return undefined;

		const previouslyFocused = document.activeElement;

		const getFocusable = () =>
			Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
				(el) => el.offsetParent !== null || el === document.activeElement,
			);

		const first = getFocusable()[0];
		if (first) first.focus();
		else container.focus();

		function onKeyDown(e) {
			if (e.key !== 'Tab') return;
			const items = getFocusable();
			if (!items.length) {
				e.preventDefault();
				return;
			}
			const firstEl = items[0];
			const lastEl = items[items.length - 1];
			if (e.shiftKey && document.activeElement === firstEl) {
				e.preventDefault();
				lastEl.focus();
			} else if (!e.shiftKey && document.activeElement === lastEl) {
				e.preventDefault();
				firstEl.focus();
			}
		}

		container.addEventListener('keydown', onKeyDown);
		return () => {
			container.removeEventListener('keydown', onKeyDown);
			if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
				previouslyFocused.focus();
			}
		};
	}, [active]);

	return ref;
}
