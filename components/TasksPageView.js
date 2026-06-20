import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { format, startOfMonth } from 'date-fns';
import Layout from './Layout';
import { PageLoader, ErrorState, EmptyState } from './LoadingSpinner';
import { isTaskAssigned, sortTasksByDateAsc, sortTasksByDateDesc, taskIsOverdue } from '../lib/constants';
import { taskHeadline, taskGuestSubtitle } from '../lib/taskDisplay';
import { fetchJson } from '../lib/apiClient';
import { formatSyncResultAlert } from '../lib/syncResultMessage';
import { TaskItem } from './TaskItem';
import TaskStatusWidgets from './TaskStatusWidgets';
import TaskFiltersPanel from './TaskFiltersPanel';
import TaskCalendarView from './TaskCalendarView';
import TaskDetailModal from './TaskDetailModal';
import SegmentedToggle from './SegmentedToggle';
import PageActionButtons from './PageActionButtons';
import PageSearchInput from './PageSearchInput';
import { useAuth } from './AuthContext';
import { hasLimitedTasksView } from '../lib/roles';
import { tabFromPathname, taskPathForTab, TASK_TAB_PATHS } from '../lib/taskRoutes';
import { taskFiltersFromQuery, taskFiltersToQuery, EMPTY_TASK_FILTERS } from '../lib/taskFilters';
import { buildTaskFilterParams } from '../lib/taskCounts';
import { useTaskCounts } from './TaskCountsContext';
import { useColumnVisibility } from './financials/useColumnVisibility';
import { ToggleableTableHead, HiddenColumnsBar } from './financials/ToggleableTableHead';

const TASK_COLUMN_LABELS = {
	status: 'Status',
	task: 'Task',
	checkout: 'Check-out',
	due: 'Due',
	assignee: 'Assignee',
	checklist: 'Checklist',
	pdf: 'PDF',
	admin: 'Admin',
};

function adminTaskColumns(isCompleted) {
	return isCompleted
		? ['status', 'task', 'checkout', 'due', 'assignee', 'checklist', 'pdf']
		: ['status', 'task', 'checkout', 'due', 'assignee', 'checklist', 'pdf', 'admin'];
}

const LIMITED_WIDGET_KEYS = ['assigned', 'completed', 'overdue'];

const TAB_OPTIONS = [
	{ value: 'unassigned', label: 'Unassigned' },
	{ value: 'assigned', label: 'Assigned' },
	{ value: 'completed', label: 'Completed' },
];

const VIEW_OPTIONS = [
	{ value: 'list', label: 'List' },
	{ value: 'calendar', label: 'Calendar' },
];

export default function TasksPageView() {
	const router = useRouter();
	const { isAdmin, user } = useAuth();
	const limitedView = hasLimitedTasksView(user);
	const routeTab = tabFromPathname(router.pathname);
	const tab = routeTab
		|| (router.query.tab === 'completed' ? 'completed'
			: router.query.tab === 'overdue' ? 'overdue'
				: router.query.tab === 'assigned' ? 'assigned'
					: router.query.tab === 'unassigned' ? 'unassigned'
						: limitedView ? 'assigned' : 'unassigned');
	const view = router.query.view === 'calendar' ? 'calendar' : 'list';
	const isUnassigned = tab === 'unassigned';
	const isAssigned = tab === 'assigned';
	const isCompleted = tab === 'completed';
	const isOverdue = tab === 'overdue';
	const isCalendar = view === 'calendar';
	const readOnly = limitedView;
	const adminColumns = useMemo(() => adminTaskColumns(isCompleted), [isCompleted]);
	const { isVisible: isAdminColumnVisible, hide: hideColumn, show: showColumn, hiddenColumns } = useColumnVisibility(adminColumns);
	const { counts: statusCounts, setTaskCounts, refreshTaskCounts: refreshGlobalTaskCounts } = useTaskCounts();
	const [tasks, setTasks] = useState([]);
	const [properties, setProperties] = useState([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const hasLoadedOnce = useRef(false);
	const fetchGenerationRef = useRef(0);
	const [error, setError] = useState('');
	const [syncing, setSyncing] = useState(false);
	const [flash, setFlash] = useState(null);
	const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
	const [selectedTask, setSelectedTask] = useState(null);
	const [filters, setFilters] = useState(EMPTY_TASK_FILTERS);
	const [search, setSearch] = useState('');

	const monthKey = format(calendarMonth, 'yyyy-MM');

	const filteredTasks = useMemo(() => {
		if (!search.trim()) return tasks;
		const q = search.toLowerCase();
		return tasks.filter(
			(t) =>
				taskHeadline(t).toLowerCase().includes(q)
				|| taskGuestSubtitle(t).toLowerCase().includes(q)
				|| t.property_name?.toLowerCase().includes(q)
				|| t.assignee?.toLowerCase().includes(q)
				|| t.title?.toLowerCase().includes(q)
				|| t.id?.toLowerCase().includes(q)
				|| t.reservation_id?.toLowerCase().includes(q),
		);
	}, [tasks, search]);

	const displayTasks = useMemo(() => {
		if (isCompleted) return sortTasksByDateDesc(filteredTasks);
		return sortTasksByDateAsc(filteredTasks);
	}, [filteredTasks, isCompleted]);

	useEffect(() => {
		if (!limitedView) {
			fetchJson('/api/properties')
				.then((json) => { if (json) setProperties(json.data || []); })
				.catch(() => setProperties([]));
		}
	}, [limitedView]);

	const filterProperties = useMemo(() => {
		if (!limitedView) return properties;
		const seen = new Map();
		for (const task of tasks) {
			if (task.property_id && !seen.has(task.property_id)) {
				seen.set(task.property_id, {
					id: task.property_id,
					name: task.property_name || task.property_id,
				});
			}
		}
		return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
	}, [limitedView, properties, tasks]);

	const buildTaskParams = useCallback((includeTab = true) => {
		const applied = router.isReady ? taskFiltersFromQuery(router.query) : filters;
		const params = buildTaskFilterParams(applied, { isCalendar, monthKey });
		if (includeTab) {
			if (isCompleted) params.set('completed', 'true');
			else if (isOverdue) params.set('overdue', 'true');
			else if (isUnassigned) params.set('unassigned', 'true');
			else params.set('assigned', 'true');
		}
		return params;
	}, [
		filters,
		router.isReady,
		router.query.property_id,
		router.query.assignee,
		router.query.status,
		router.query.date_from,
		router.query.date_to,
		router.query.today,
		isUnassigned,
		isAssigned,
		isCompleted,
		isOverdue,
		isCalendar,
		monthKey,
	]);

	const refreshCounts = useCallback(async () => {
		const applied = router.isReady ? taskFiltersFromQuery(router.query) : filters;
		await refreshGlobalTaskCounts(applied, { isCalendar, monthKey });
	}, [
		filters,
		router.isReady,
		router.query,
		isCalendar,
		monthKey,
		refreshGlobalTaskCounts,
	]);

	const loadTasks = useCallback(async () => {
		const generation = ++fetchGenerationRef.current;
		if (hasLoadedOnce.current) setRefreshing(true);
		else setLoading(true);
		setError('');
		try {
			const params = buildTaskParams(true);
			params.set('_', String(Date.now()));
			const json = await fetchJson('/api/tasks?' + params);
			if (generation !== fetchGenerationRef.current) return;
			if (json) {
				setTasks(json.data || []);
				if (json.counts) setTaskCounts(json.counts);
			}
		} catch (err) {
			if (generation !== fetchGenerationRef.current) return;
			setError(err.message);
		} finally {
			if (generation !== fetchGenerationRef.current) return;
			setLoading(false);
			setRefreshing(false);
			hasLoadedOnce.current = true;
		}
	}, [buildTaskParams, setTaskCounts]);

	async function syncTasks() {
		setSyncing(true);
		try {
			const json = await fetchJson('/api/tasks/sync', { method: 'POST' });
			if (json) alert(formatSyncResultAlert(json));
			loadTasks();
		} catch (err) {
			alert('Sync failed: ' + err.message);
		} finally {
			setSyncing(false);
		}
	}

	useEffect(() => {
		if (!router.isReady) return;
		if (router.pathname !== '/tasks') return;
		const tabParam = router.query.tab;
		if (typeof tabParam !== 'string' || !TASK_TAB_PATHS[tabParam]) return;
		const { tab: _tab, ...rest } = router.query;
		router.replace({ pathname: TASK_TAB_PATHS[tabParam], query: rest }, undefined, { shallow: false });
	}, [router.isReady, router.pathname, router.query.tab]);

	useEffect(() => {
		if (!router.isReady) return;
		setFilters(taskFiltersFromQuery(router.query));
	}, [router.isReady, router.pathname, router.query.property_id, router.query.assignee, router.query.status, router.query.date_from, router.query.date_to, router.query.today]);

	const applyFilters = useCallback(() => {
		const query = taskFiltersToQuery(filters, router.query);
		if (router.query.view === 'calendar') {
			query.view = 'calendar';
			delete query.today;
			delete query.date_from;
			delete query.date_to;
		}
		router.replace({ pathname: router.pathname, query }, undefined, { shallow: true });
	}, [filters, router]);

	const setTab = useCallback((next) => {
		const query = taskFiltersToQuery(filters, router.query);
		if (router.query.view === 'calendar') {
			query.view = 'calendar';
			delete query.today;
			delete query.date_from;
			delete query.date_to;
		}
		router.replace({ pathname: taskPathForTab(next), query }, undefined, { shallow: false });
	}, [router, filters]);

	const setView = useCallback((next) => {
		const query = taskFiltersToQuery(filters, router.query);
		if (next === 'calendar') {
			query.view = 'calendar';
			delete query.today;
			delete query.date_from;
			delete query.date_to;
		} else {
			delete query.view;
		}
		router.replace({ pathname: router.pathname, query }, undefined, { shallow: true });
	}, [router, filters]);

	useEffect(() => {
		if (!router.isReady) return;
		loadTasks();
	}, [
		router.isReady,
		tab,
		view,
		monthKey,
		loadTasks,
		router.query.property_id,
		router.query.assignee,
		router.query.status,
		router.query.date_from,
		router.query.date_to,
		router.query.today,
	]);

	const handleAssigneeChanged = useCallback(({ assignee, notified, error: assigneeError }) => {
		if (assigneeError) {
			setFlash({ type: 'error', message: assigneeError });
			return;
		}
		if (!assignee) return;

		let message = `Assigned to ${assignee}.`;

		if (notified?.emailed || notified?.texted) {
			const channels = [notified.emailed && 'email', notified.texted && 'text'].filter(Boolean).join(' and ');
			message += ` Notification sent by ${channels}.`;
		} else if (notified?.skipped) {
			message += ' No email/text on file for notifications.';
		}

		setFlash({ type: 'success', message });
		refreshCounts();
	}, [refreshCounts]);

	useEffect(() => {
		if (!flash) return undefined;
		const timer = setTimeout(() => setFlash(null), 6000);
		return () => clearTimeout(timer);
	}, [flash]);

	function taskStaysOnTab(updated) {
		if (isCompleted) return updated.status === 'completed';
		if (isOverdue) return taskIsOverdue(updated);
		if (isUnassigned) return !isTaskAssigned(updated) && updated.status !== 'completed';
		return isTaskAssigned(updated) && updated.status !== 'completed' && !taskIsOverdue(updated);
	}

	function handleUpdate(updated) {
		if (!taskStaysOnTab(updated)) {
			setTasks((prev) => prev.filter((t) => t.id !== updated.id));
			if (updated.status === 'completed' && isAssigned) {
				setFlash({ type: 'success', message: 'Task marked completed. View it under Tasks → Completed.' });
			}
		} else {
			setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
		}
		refreshCounts();
	}

	return (
		<>
			<Head>
				<title>{`${limitedView ? 'My Tasks' : 'Tasks'} — Hello Neighbor`}</title>
			</Head>
			<Layout title="">
				{selectedTask && (
					<TaskDetailModal
						task={selectedTask}
						onClose={() => setSelectedTask(null)}
						showAssignee={isAdmin}
						showAdmin={isAdmin}
						onTaskUpdated={(updated) => {
							setSelectedTask(updated);
							handleUpdate(updated);
						}}
					/>
				)}
				<div className="flex flex-col gap-4 mb-6 w-full min-w-0">
					<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
						<div className="shrink-0">
							<h1 className="text-xl sm:text-2xl font-bold text-dark whitespace-nowrap">
								{limitedView ? 'My Tasks' : 'Tasks'}
							</h1>
						</div>
						<div className="flex flex-wrap items-center gap-2 justify-end w-full lg:w-auto min-w-0">
							<PageSearchInput
								placeholder="Search tasks…"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
							/>
							<PageActionButtons
								onRefresh={loadTasks}
								onSynced={loadTasks}
								showSync={isAdmin}
								refreshing={refreshing || loading}
							/>
						</div>
					</div>
					<div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
						{isAdmin && (
							<SegmentedToggle value={tab} onChange={setTab} options={TAB_OPTIONS} />
						)}
						<SegmentedToggle value={view} onChange={setView} options={VIEW_OPTIONS} />
					</div>
				</div>

				<TaskStatusWidgets
					counts={statusCounts}
					activeKey={tab}
					onSelect={setTab}
					visibleKeys={limitedView ? LIMITED_WIDGET_KEYS : undefined}
					clickableKeys={limitedView ? LIMITED_WIDGET_KEYS : ['unassigned', 'assigned', 'completed', 'overdue']}
				/>

				{flash && (
					<div
						className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
							flash.type === 'error'
								? 'border-red-200 bg-red-50 text-red-800'
								: 'border-green-200 bg-green-50 text-green-800'
						}`}
						role="status"
					>
						{flash.message}
					</div>
				)}

				<TaskFiltersPanel
					filters={filters}
					setFilters={setFilters}
					properties={filterProperties}
					onApply={applyFilters}
					isAdmin={isAdmin}
					isCalendar={isCalendar}
				/>

				{loading && <PageLoader message="Loading tasks…" />}
				{error && !loading && (
					<ErrorState
						message={error}
						retry={loadTasks}
					/>
				)}

				{!loading && !error && (
					tasks.length === 0
						? (
							<EmptyState
								title={
									limitedView
										? isCompleted ? 'No completed tasks'
											: isOverdue ? 'No overdue tasks'
												: 'No tasks assigned'
										: isCompleted ? 'No completed tasks'
											: isOverdue ? 'No overdue tasks'
											: isUnassigned ? 'No unassigned tasks'
												: 'No assigned tasks'
								}
								message={
									isCalendar
										? 'No tasks due in this month with the current filters.'
										: limitedView
											? isCompleted
												? 'Your completed tasks will appear here.'
												: isOverdue
													? 'You have no overdue tasks right now.'
													: 'You have no tasks assigned right now. Check back later or contact your admin.'
											: isCompleted
												? 'Completed tasks will appear here after you mark them done.'
												: isOverdue
													? 'Overdue tasks appear here when due dates pass.'
													: isUnassigned
													? 'New turnovers appear here after you sync from Reservations.'
													: 'Assign someone on the Unassigned tab to move a task here.'
								}
								action={
									isUnassigned && isAdmin ? (
										<button type="button" onClick={syncTasks} disabled={syncing} className="btn-primary mt-2">
											{syncing ? 'Syncing…' : 'Sync Tasks Now'}
										</button>
									) : !limitedView && isAssigned ? (
										<button type="button" onClick={() => setTab('unassigned')} className="btn-primary mt-2">
											View unassigned tasks
										</button>
									) : null
								}
							/>
						)
						: displayTasks.length === 0
							? (
								<EmptyState
									title="No tasks match your search"
									message="Try a different search term"
								/>
							)
						: isCalendar ? (
							<TaskCalendarView
								tasks={displayTasks}
								month={calendarMonth}
								onMonthChange={setCalendarMonth}
								onTaskSelect={setSelectedTask}
							/>
						)
						: (
							<>
								<div className="space-y-3 lg:hidden">
									{displayTasks.map((task) => (
										<TaskItem
											key={task.id}
											task={task}
											variant="card"
											onSelect={setSelectedTask}
											onUpdate={handleUpdate}
											onAssigneeChanged={handleAssigneeChanged}
											showAdmin={isAdmin && !isCompleted}
											readOnly={readOnly}
											assigneeReadOnly={isCompleted}
											isCompletedTab={isCompleted}
										/>
									))}
								</div>

								<div className="w-full min-w-0 max-w-full">
								<div className="card overflow-x-auto hidden lg:block">
									{isAdmin && (
										<HiddenColumnsBar
											columns={hiddenColumns}
											labels={TASK_COLUMN_LABELS}
											onShow={showColumn}
											hint=""
										/>
									)}
									<table className="w-full min-w-[900px]">
										<thead className="bg-gray-50 border-b border-border">
											<tr>
												{isAdmin ? (
													adminColumns.map((key) =>
														isAdminColumnVisible(key) ? (
															<ToggleableTableHead
																key={key}
																label={TASK_COLUMN_LABELS[key]}
																onHide={() => hideColumn(key)}
																compact={key === 'status'}
															/>
														) : null,
													)
												) : (
													<>
														<th className="table-head w-10 px-2"><span className="sr-only">Status</span></th>
														<th className="table-head">Task</th>
														<th className="table-head">Check-out</th>
														<th className="table-head">Due</th>
														{(!readOnly || isCompleted) && <th className="table-head">Assignee</th>}
														<th className="table-head">Checklist</th>
														<th className="table-head">PDF</th>
													</>
												)}
											</tr>
										</thead>
										<tbody className="divide-y divide-border">
											{displayTasks.map((task) => (
												<TaskItem
													key={task.id}
													task={task}
													variant="row"
													onSelect={setSelectedTask}
													onUpdate={handleUpdate}
													onAssigneeChanged={handleAssigneeChanged}
													showAdmin={isAdmin && !isCompleted}
													readOnly={readOnly}
													assigneeReadOnly={isCompleted}
													isColumnVisible={isAdmin ? isAdminColumnVisible : undefined}
													isCompletedTab={isCompleted}
												/>
											))}
										</tbody>
									</table>
								</div>
								</div>
							</>
						)
				)}
			</Layout>
		</>
	);
}
