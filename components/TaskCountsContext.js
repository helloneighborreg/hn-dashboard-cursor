import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { fetchJson } from '../lib/apiClient';
import { EMPTY_TASK_COUNTS, buildTaskCountsParams } from '../lib/taskCounts';
import { useAuth } from './AuthContext';

const TaskCountsContext = createContext({
	counts: EMPTY_TASK_COUNTS,
	setTaskCounts: () => {},
	refreshTaskCounts: async () => {},
});

export function TaskCountsProvider({ children }) {
	const { user } = useAuth();
	const router = useRouter();
	const [counts, setTaskCounts] = useState(EMPTY_TASK_COUNTS);

	const refreshTaskCounts = useCallback(async (applied = {}, options = {}) => {
		if (!user) return;
		try {
			const params = buildTaskCountsParams(applied, options);
			params.set('_', String(Date.now()));
			const json = await fetchJson('/api/tasks?' + params);
			if (json?.counts) setTaskCounts(json.counts);
		} catch {
			// Keep existing counts on failure.
		}
	}, [user]);

	useEffect(() => {
		if (!user) {
			setTaskCounts(EMPTY_TASK_COUNTS);
			return;
		}
		if (router.pathname.startsWith('/tasks')) return;
		refreshTaskCounts({});
	}, [user, router.pathname, refreshTaskCounts]);

	return (
		<TaskCountsContext.Provider value={{ counts, setTaskCounts, refreshTaskCounts }}>
			{children}
		</TaskCountsContext.Provider>
	);
}

export function useTaskCounts() {
	return useContext(TaskCountsContext);
}
