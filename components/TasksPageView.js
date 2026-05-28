import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { RefreshCw } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import Layout from './Layout';
import { PageLoader, ErrorState, EmptyState } from './LoadingSpinner';
import { ASSIGNEES, isTaskAssigned, statusFromAssignee, taskIsOverdue } from '../lib/constants';
import {
	taskHeadline,
	taskGuestSubtitle,
	formatDateShort,
	formatClock,
} from '../lib/taskDisplay';
import { fetchJson } from '../lib/apiClient';
import TaskStatusIndicator from './TaskStatusIndicator';
import AdminCompleteButton from './AdminCompleteButton';
import TaskStatusWidgets from './TaskStatusWidgets';
import TaskFiltersPanel from './TaskFiltersPanel';
import TaskCalendarView from './TaskCalendarView';
import TaskDetailModal from './TaskDetailModal';
import SegmentedToggle from './SegmentedToggle';
import { useAuth } from './AuthContext';
import { hasLimitedTasksView } from '../lib/roles';

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

function useTaskActions(task, onUpdate, onAssigneeChanged) {
	const [saving, setSaving] = useState(false);

	async function patch(updates) {
		setSaving(true);
		try {
			const res = await fetch(`/api/tasks/${task.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updates),
			});
			const json = await res.json().catch(() => ({}));
			if (res.ok) {
				onUpdate(json.data);
				if (updates.assignee !== undefined) {
					onAssigneeChanged?.({
						assignee: updates.assignee || null,
						notified: json.notified || null,
					});
				}
				return true;
			}
			if (updates.assignee !== undefined) {
				onAssigneeChanged?.({ error: json.error || 'Could not save assignment' });
			}
			return false;
		} finally {
			setSaving(false);
		}
	}

	return { patch, saving };
}

function ChecklistLink({ url }) {
	if (!url) return <span className="text-xs text-muted">—</span>;
	return (
		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			className="btn-secondary text-xs whitespace-nowrap inline-flex"
		>
			Open Checklist
		</a>
	);
}

function ChecklistPdfLink({ url }) {
	if (!url) return <span className="text-xs text-muted">—</span>;
	return (
		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			className="btn-secondary text-xs whitespace-nowrap inline-flex"
		>
			View PDF
		</a>
	);
}

function TaskItem({ task, variant, onUpdate, onAssigneeChanged, showAdmin, readOnly, assigneeReadOnly }) {
	const { patch, saving } = useTaskActions(task, onUpdate, onAssigneeChanged);
	const isOverdue = taskIsOverdue(task);
	const completed = task.status === 'completed';
	const isCard = variant === 'card';

	function setAssignee(value) {
		const assignee = value || null;
		patch({ assignee, status: statusFromAssignee(assignee) });
	}

	function markComplete() {
		patch({ status: 'completed' });
	}

	const assigneeSelect = (
		<select
			className={isCard ? 'select text-sm w-full' : 'select text-xs py-1 w-44'}
			value={task.assignee || ''}
			onChange={(e) => setAssignee(e.target.value)}
			disabled={saving}
		>
			<option value="">Unassigned</option>
			{ASSIGNEES.map((a) => <option key={a} value={a}>{a}</option>)}
		</select>
	);

	const adminControl = completed ? (
		<span className={`text-green-700 font-medium ${isCard ? 'text-sm' : 'text-xs'}`}>Completed</span>
	) : (
		<AdminCompleteButton onConfirm={markComplete} disabled={saving} size={isCard ? 'md' : 'sm'} />
	);

	if (isCard) {
		return (
			<div className="card p-4 space-y-3 w-full min-w-0">
				<div className="flex items-start gap-3 min-w-0">
					<TaskStatusIndicator task={task} />
					<div className="min-w-0 flex-1">
						<p className="text-sm font-semibold font-mono tracking-wide leading-snug text-dark">
							{taskHeadline(task)}
						</p>
						<p className="text-xs text-muted mt-1">{taskGuestSubtitle(task)}</p>
					</div>
				</div>

				<dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
					<div>
						<dt className="text-xs text-muted">Check-out</dt>
						<dd className="text-dark">
							{formatDateShort(task.checkout_date || task.due_date)}
							<span className="text-muted text-xs"> · {formatClock(task.start_time || '10:00')}</span>
						</dd>
					</div>
					<div>
						<dt className="text-xs text-muted">Due</dt>
						<dd className={isOverdue ? 'text-red-600 font-semibold' : 'text-dark'}>
							{formatDateShort(task.due_date)}
							<span className="text-muted text-xs font-normal"> · {formatClock(task.due_time || '16:00')}</span>
						</dd>
					</div>
					{isOverdue && (
						<div className="col-span-2">
							<span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Overdue</span>
						</div>
					)}
				</dl>

				<div className="flex items-center gap-2 flex-wrap">
					<ChecklistLink url={task.checklist_url} />
					<ChecklistPdfLink url={task.checklist_pdf_url} />
				</div>

				{showAdmin && (
					<div>
						<label className="label">Admin</label>
						{adminControl}
					</div>
				)}

				{(readOnly || assigneeReadOnly) ? (
					<div>
						<label className="label">Assignee</label>
						<p className="text-sm text-dark">{task.assignee || '—'}</p>
					</div>
				) : (
					<div>
						<label className="label">Assignee</label>
						{assigneeSelect}
					</div>
				)}
			</div>
		);
	}

	return (
		<tr className="hover:bg-gray-50 transition-colors">
			<td className="table-cell w-12">
				<TaskStatusIndicator task={task} />
			</td>
			<td className="table-cell">
				<div className="min-w-0">
					<p className="text-sm font-semibold font-mono tracking-wide text-dark">
						{taskHeadline(task)}
					</p>
					<p className="text-xs text-muted mt-0.5">{taskGuestSubtitle(task)}</p>
				</div>
			</td>
			<td className="table-cell">
				<p className="text-sm text-dark">{formatDateShort(task.checkout_date || task.due_date)}</p>
				<p className="text-xs text-muted">{formatClock(task.start_time || '10:00')}</p>
			</td>
			<td className="table-cell">
				<p className={`text-sm ${isOverdue ? 'text-red-600 font-semibold' : 'text-dark'}`}>
					{formatDateShort(task.due_date)}
				</p>
				<p className="text-xs text-muted">{formatClock(task.due_time || '16:00')}</p>
				{isOverdue && <span className="text-xs text-red-600 font-medium">Overdue</span>}
			</td>
			{(assigneeReadOnly || !readOnly) && (
				<td className="table-cell">
					{assigneeReadOnly
						? <span className="text-sm text-dark">{task.assignee || '—'}</span>
						: assigneeSelect}
				</td>
			)}
			<td className="table-cell">
				<ChecklistLink url={task.checklist_url} />
			</td>
			<td className="table-cell">
				<ChecklistPdfLink url={task.checklist_pdf_url} />
			</td>
			{showAdmin && (
				<td className="table-cell">{adminControl}</td>
			)}
		</tr>
	);
}

export default function TasksPageView() {
	const router = useRouter();
	const { isAdmin, user } = useAuth();
	const limitedView = hasLimitedTasksView(user);
	const tab = limitedView
		? router.query.tab === 'completed'
			? 'completed'
			: router.query.tab === 'overdue'
				? 'overdue'
				: 'assigned'
		: router.query.tab === 'overdue'
			? 'overdue'
			: router.query.tab === 'assigned'
			? 'assigned'
			: router.query.tab === 'completed'
				? 'completed'
				: 'unassigned';
	const view = router.query.view === 'calendar' ? 'calendar' : 'list';
	const isUnassigned = tab === 'unassigned';
	const isAssigned = tab === 'assigned';
	const isCompleted = tab === 'completed';
	const isOverdue = tab === 'overdue';
	const isCalendar = view === 'calendar';
	const readOnly = limitedView;
	const [tasks, setTasks] = useState([]);
	const [statusCounts, setStatusCounts] = useState({
		unassigned: 0, assigned: 0, completed: 0, overdue: 0,
	});
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
	const [filters, setFilters] = useState({
		property_id: '', status: '', assignee: '', date_from: '', date_to: '',
		today: false,
	});

	const monthKey = format(calendarMonth, 'yyyy-MM');

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
		const params = new URLSearchParams();
		if (includeTab) {
			if (isCompleted) params.set('completed', 'true');
			else if (isOverdue) params.set('overdue', 'true');
			else if (isUnassigned) params.set('unassigned', 'true');
			else params.set('assigned', 'true');
		}
		const propertyId = router.query.property_id;
		if (propertyId) params.set('property_id', String(propertyId));
		if (filters.property_id) params.set('property_id', filters.property_id);
		if (filters.status && includeTab && isAssigned) params.set('status', filters.status);
		if (filters.assignee && !isCompleted) params.set('assignee', filters.assignee);

		if (filters.today) {
			params.set('today', 'true');
		} else if (isCalendar) {
			const [year, month] = monthKey.split('-').map(Number);
			const monthDate = new Date(year, month - 1, 1);
			const monthStart = format(startOfMonth(monthDate), 'yyyy-MM-dd');
			const monthEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd');
			const dateFrom = filters.date_from && filters.date_from > monthStart ? filters.date_from : monthStart;
			const dateTo = filters.date_to && filters.date_to < monthEnd ? filters.date_to : monthEnd;
			if (dateFrom <= dateTo) {
				params.set('date_from', dateFrom);
				params.set('date_to', dateTo);
			}
		} else {
			if (filters.date_from) params.set('date_from', filters.date_from);
			if (filters.date_to) params.set('date_to', filters.date_to);
		}

		return params;
	}, [
		filters.property_id,
		filters.status,
		filters.assignee,
		filters.date_from,
		filters.date_to,
		filters.today,
		isUnassigned,
		isAssigned,
		isCompleted,
		isOverdue,
		isCalendar,
		monthKey,
		router.query.property_id,
	]);

	const refreshCounts = useCallback(async () => {
		try {
			const params = buildTaskParams(false);
			params.set('counts_only', 'true');
			params.set('_', String(Date.now()));
			const json = await fetchJson('/api/tasks?' + params);
			if (json?.counts) setStatusCounts(json.counts);
		} catch {
			// Keep existing counts on refresh failure.
		}
	}, [buildTaskParams]);

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
				if (json.counts) setStatusCounts(json.counts);
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
	}, [buildTaskParams]);

	async function syncTasks() {
		setSyncing(true);
		try {
			const json = await fetchJson('/api/tasks/sync', { method: 'POST' });
			if (json) {
				alert(
					`Sync complete. ${json.created ?? 0} created, ${json.updated ?? 0} updated, ${json.deleted ?? 0} removed (cancelled).`,
				);
			}
			loadTasks();
		} catch (err) {
			alert('Sync failed: ' + err.message);
		} finally {
			setSyncing(false);
		}
	}

	useEffect(() => {
		if (!router.isReady) return;
		const fromUrl = router.query.property_id;
		if (typeof fromUrl === 'string' && fromUrl) {
			setFilters((f) => (f.property_id === fromUrl ? f : { ...f, property_id: fromUrl }));
		}
	}, [router.isReady, router.query.property_id]);

	useEffect(() => {
		if (!router.isReady) return;
		loadTasks();
	}, [router.isReady, tab, view, monthKey, loadTasks]);

	const setTab = useCallback((next) => {
		const query = { ...router.query };
		if (next === 'unassigned' || (limitedView && next === 'assigned')) delete query.tab;
		else query.tab = next;
		router.replace({ pathname: '/tasks', query }, undefined, { shallow: true });
	}, [router, limitedView]);

	const setView = useCallback((next) => {
		const query = { ...router.query };
		if (next === 'calendar') query.view = 'calendar';
		else delete query.view;
		router.replace({ pathname: '/tasks', query }, undefined, { shallow: true });
	}, [router]);

	const handleAssigneeChanged = useCallback(({ assignee, notified, error: assigneeError }) => {
		if (assigneeError) {
			setFlash({ type: 'error', message: assigneeError });
			return;
		}
		if (!assignee) return;

		let message = `Assigned to ${assignee}.`;
		if (tab === 'unassigned') {
			setTab('assigned');
			message += ' Switched to the Assigned tab.';
		}

		if (notified?.emailed || notified?.texted) {
			const channels = [notified.emailed && 'email', notified.texted && 'text'].filter(Boolean).join(' and ');
			message += ` Notification sent by ${channels}.`;
		} else if (notified?.skipped) {
			message += ' No email/text on file for notifications.';
		}

		setFlash({ type: 'success', message });
		refreshCounts();
	}, [tab, setTab, refreshCounts]);

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
				setFlash({ type: 'success', message: 'Task marked completed. View it on the Completed tab.' });
			}
		} else {
			setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
		}
		refreshCounts();
	}

	const tabSummary = limitedView
		? isCompleted
			? `${tasks.length} completed by you`
			: isOverdue
				? `${tasks.length} overdue`
				: `${tasks.length} assigned to you`
		: isCompleted
			? `${tasks.length} completed`
			: isOverdue
				? `${tasks.length} overdue`
				: isUnassigned
					? `${tasks.length} awaiting assignee`
					: `${tasks.length} assigned`;

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
					/>
				)}
				<div className="flex flex-col gap-4 mb-6 md:flex-row md:items-start md:justify-between">
					<div className="min-w-0 space-y-3">
						<div>
							<h1 className="text-xl sm:text-2xl font-bold text-dark">
								{limitedView ? 'My Tasks' : 'Tasks'}
							</h1>
							<p className="text-muted text-sm mt-0.5">{tabSummary}</p>
						</div>
						{isAdmin && (
							<SegmentedToggle value={tab} onChange={setTab} options={TAB_OPTIONS} />
						)}
						<SegmentedToggle value={view} onChange={setView} options={VIEW_OPTIONS} />
					</div>
					<div className="flex flex-col gap-2 w-full md:w-auto md:flex-row md:items-center">
						{isUnassigned && isAdmin && (
							<button
								type="button"
								onClick={syncTasks}
								disabled={syncing}
								className="btn-secondary text-xs gap-1.5 justify-center w-full md:w-auto"
							>
								<RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
								{syncing ? 'Syncing…' : 'Sync from Reservations'}
							</button>
						)}
						<button
							type="button"
							onClick={loadTasks}
							disabled={refreshing || loading}
							className="btn-secondary text-xs gap-1.5 justify-center w-full md:w-auto"
						>
							<RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
							{refreshing ? 'Refreshing…' : 'Refresh'}
						</button>
					</div>
				</div>

				<TaskStatusWidgets
					counts={statusCounts}
					activeKey={tab}
					onSelect={setTab}
					visibleKeys={limitedView ? LIMITED_WIDGET_KEYS : undefined}
					clickableKeys={limitedView ? LIMITED_WIDGET_KEYS : ['unassigned', 'assigned', 'completed']}
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
					isUnassigned={isUnassigned}
					onApply={loadTasks}
					showAssigneeFilter={isAdmin && !isCompleted}
					showStatusFilter={isAssigned}
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
						: isCalendar ? (
							<TaskCalendarView
								tasks={tasks}
								month={calendarMonth}
								onMonthChange={setCalendarMonth}
								onTaskSelect={setSelectedTask}
							/>
						)
						: (
							<>
								<div className="space-y-3 lg:hidden">
									{tasks.map((task) => (
										<TaskItem
											key={task.id}
											task={task}
											variant="card"
											onUpdate={handleUpdate}
											onAssigneeChanged={handleAssigneeChanged}
											showAdmin={isAdmin && !isCompleted}
											readOnly={readOnly}
											assigneeReadOnly={isCompleted}
										/>
									))}
								</div>

								<div className="card overflow-x-auto hidden lg:block">
									<table className="w-full min-w-[900px]">
										<thead className="bg-gray-50 border-b border-border">
											<tr>
												<th className="table-head">Status</th>
												<th className="table-head">Task</th>
												<th className="table-head">Check-out</th>
												<th className="table-head">Due</th>
												{(!readOnly || isCompleted) && <th className="table-head">Assignee</th>}
												<th className="table-head">Checklist</th>
												<th className="table-head">PDF</th>
												{isAdmin && !isCompleted && <th className="table-head">Admin</th>}
											</tr>
										</thead>
										<tbody className="divide-y divide-border">
											{tasks.map((task) => (
												<TaskItem
													key={task.id}
													task={task}
													variant="row"
													onUpdate={handleUpdate}
													onAssigneeChanged={handleAssigneeChanged}
													showAdmin={isAdmin && !isCompleted}
													readOnly={readOnly}
													assigneeReadOnly={isCompleted}
												/>
											))}
										</tbody>
									</table>
								</div>
							</>
						)
				)}
			</Layout>
		</>
	);
}
