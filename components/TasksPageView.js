import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { RefreshCw } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import Layout from './Layout';
import { PageLoader, ErrorState, EmptyState } from './LoadingSpinner';
import { ASSIGNEES, isTaskAssigned, statusFromAssignee, taskIsOverdue, countTasksByIndicator } from '../lib/constants';
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

const TAB_OPTIONS = [
	{ value: 'unassigned', label: 'Unassigned' },
	{ value: 'assigned', label: 'Assigned' },
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

function TaskItem({ task, variant, onUpdate, onAssigneeChanged, showAdmin, readOnly }) {
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
				</div>

				{showAdmin && (
					<div>
						<label className="label">Admin</label>
						{adminControl}
					</div>
				)}

				{readOnly ? (
					task.assignee && (
						<div>
							<label className="label">Assignee</label>
							<p className="text-sm text-dark">{task.assignee}</p>
						</div>
					)
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
			{!readOnly && (
				<td className="table-cell">{assigneeSelect}</td>
			)}
			<td className="table-cell">
				<ChecklistLink url={task.checklist_url} />
			</td>
			{showAdmin && (
				<td className="table-cell">{adminControl}</td>
			)}
		</tr>
	);
}

export default function TasksPageView() {
	const router = useRouter();
	const { isAdmin, isCleaner } = useAuth();
	const tab = isCleaner || router.query.tab === 'assigned' ? 'assigned' : 'unassigned';
	const view = router.query.view === 'calendar' ? 'calendar' : 'list';
	const isUnassigned = tab === 'unassigned';
	const isCalendar = view === 'calendar';
	const readOnly = isCleaner;
	const [tasks, setTasks] = useState([]);
	const [properties, setProperties] = useState([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const hasLoadedOnce = useRef(false);
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
		if (!isCleaner) {
			fetchJson('/api/properties')
				.then((json) => { if (json) setProperties(json.data || []); })
				.catch(() => setProperties([]));
		}
	}, [isCleaner]);

	const filterProperties = useMemo(() => {
		if (!isCleaner) return properties;
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
	}, [isCleaner, properties, tasks]);

	const loadTasks = useCallback(async () => {
		if (hasLoadedOnce.current) setRefreshing(true);
		else setLoading(true);
		setError('');
		try {
			const params = new URLSearchParams();
			params.set(isUnassigned ? 'unassigned' : 'assigned', 'true');
			const propertyId = router.query.property_id;
			if (propertyId) params.set('property_id', String(propertyId));
			if (filters.property_id) params.set('property_id', filters.property_id);
			if (filters.status) params.set('status', filters.status);
			if (filters.assignee) params.set('assignee', filters.assignee);

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

			const json = await fetchJson('/api/tasks?' + params);
			if (json) setTasks(json.data || []);
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
			setRefreshing(false);
			hasLoadedOnce.current = true;
		}
	}, [
		filters.property_id,
		filters.status,
		filters.assignee,
		filters.date_from,
		filters.date_to,
		filters.today,
		isUnassigned,
		isCalendar,
		monthKey,
		router.query.property_id,
	]);

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
		if (next === 'assigned') query.tab = 'assigned';
		else delete query.tab;
		router.replace({ pathname: '/tasks', query }, undefined, { shallow: true });
	}, [router]);

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
	}, [tab, setTab]);

	useEffect(() => {
		if (!flash) return undefined;
		const timer = setTimeout(() => setFlash(null), 6000);
		return () => clearTimeout(timer);
	}, [flash]);

	function handleUpdate(updated) {
		const staysOnPage = isUnassigned ? !isTaskAssigned(updated) : isTaskAssigned(updated);
		if (!staysOnPage) {
			setTasks((prev) => prev.filter((t) => t.id !== updated.id));
			return;
		}
		setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
	}

	const statusCounts = useMemo(() => countTasksByIndicator(tasks), [tasks]);

	return (
		<>
			<Head>
				<title>{`${isCleaner ? 'My Tasks' : 'Tasks'} — Hello Neighbor`}</title>
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
								{isCleaner ? 'My Tasks' : 'Tasks'}
							</h1>
							<p className="text-muted text-sm mt-0.5">
								{isCleaner
									? `${tasks.length} assigned to you`
									: `${tasks.length} ${isUnassigned ? 'awaiting assignee' : 'assigned'}`}
							</p>
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
							className="btn-secondary text-xs gap-1.5 justify-center w-full md:w-auto"
						>
							<RefreshCw size={14} /> Refresh
						</button>
					</div>
				</div>

				<TaskStatusWidgets counts={statusCounts} />

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
					showAssigneeFilter={isAdmin}
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
								title={isCleaner ? 'No tasks assigned' : isUnassigned ? 'No unassigned tasks' : 'No assigned tasks'}
								message={
									isCalendar
										? 'No tasks due in this month with the current filters.'
										: isCleaner
											? 'You have no tasks assigned right now. Check back later or contact your admin.'
											: isUnassigned
												? 'New turnovers appear here after you sync from Reservations.'
												: 'Assign someone on the Unassigned tab to move a task here.'
								}
								action={
									isUnassigned && isAdmin ? (
										<button type="button" onClick={syncTasks} disabled={syncing} className="btn-primary mt-2">
											{syncing ? 'Syncing…' : 'Sync Tasks Now'}
										</button>
									) : !isCleaner && !isUnassigned ? (
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
											showAdmin={isAdmin}
											readOnly={readOnly}
										/>
									))}
								</div>

								<div className="card overflow-x-auto hidden lg:block">
									<table className="w-full min-w-[800px]">
										<thead className="bg-gray-50 border-b border-border">
											<tr>
												<th className="table-head">Status</th>
												<th className="table-head">Task</th>
												<th className="table-head">Check-out</th>
												<th className="table-head">Due</th>
												{!readOnly && <th className="table-head">Assignee</th>}
												<th className="table-head">Checklist</th>
												{isAdmin && <th className="table-head">Admin</th>}
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
													showAdmin={isAdmin}
													readOnly={readOnly}
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
