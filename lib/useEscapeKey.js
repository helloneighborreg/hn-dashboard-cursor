import { useEffect } from 'react';

/** Calls `handler` when the Escape key is pressed (for closing modals/drawers). */
export function useEscapeKey(handler) {
	useEffect(() => {
		if (typeof handler !== 'function') return undefined;
		function onKeyDown(e) {
			if (e.key === 'Escape') handler(e);
		}
		document.addEventListener('keydown', onKeyDown);
		return () => document.removeEventListener('keydown', onKeyDown);
	}, [handler]);
}
