import { useCallback, useState } from 'react';

export function useTableSort(defaultKey = null, defaultDir = 'asc') {
	const [sort, setSort] = useState({ key: defaultKey, dir: defaultDir });

	const toggleSort = useCallback((key) => {
		setSort((prev) => {
			if (prev.key === key) {
				return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
			}
			return { key, dir: 'asc' };
		});
	}, []);

	return {
		sortKey: sort.key,
		sortDir: sort.dir,
		toggleSort,
		setSort,
	};
}
