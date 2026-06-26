import { useCallback, useMemo, useState } from 'react';

export function useColumnVisibility(columnKeys, { minVisible = 1 } = {}) {
	const [hidden, setHidden] = useState(() => new Set());

	const isVisible = useCallback(
		(key) => columnKeys.includes(key) && !hidden.has(key),
		[columnKeys, hidden],
	);

	const hide = useCallback(
		(key) => {
			setHidden((prev) => {
				const visibleCount = columnKeys.length - prev.size;
				if (visibleCount <= minVisible) return prev;
				return new Set([...prev, key]);
			});
		},
		[columnKeys.length, minVisible],
	);

	const show = useCallback((key) => {
		setHidden((prev) => {
			if (!prev.has(key)) return prev;
			const next = new Set(prev);
			next.delete(key);
			return next;
		});
	}, []);

	const hiddenColumns = useMemo(
		() => columnKeys.filter((key) => hidden.has(key)),
		[columnKeys, hidden],
	);

	const visibleCount = columnKeys.length - hiddenColumns.length;

	return { isVisible, hide, show, hiddenColumns, visibleCount };
}
