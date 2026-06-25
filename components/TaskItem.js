import { useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, ListChecks, FileText } from 'lucide-react';
import { ASSIGNEES, statusFromAssignee, taskIsOverdue } from '../lib/constants';
import { fetchJson } from '../lib/apiClient';
import { taskHeadline, taskGuestSubtitle, formatDateShort, formatClock } from '../lib/taskDisplay';
import { taskHasPets } from '../lib/reservationPets';
import { getTaskTypeStyle, taskTypeLabel } from '../lib/taskTypeStyles';
import TaskStatusIndicator from './TaskStatusIndicator';
import AdminCompleteButton from './AdminCompleteButton';
import TaskPetIndicator from './TaskPetIndicator';
import TaskDueEditor from './TaskDueEditor';
import TaskPaidIndicator from './TaskPaidIndicator';
import TaskPaidToggle from './TaskPaidToggle';
import { useAuth } from './AuthContext';
import { canViewReservationData } from '../lib/roles';

export function useTaskActions(task, onUpdate, onAssigneeChanged, onDeleted) {
	const [saving, setSaving] = useState(false);
	const [deleting, setDeleting] = useState(false);

	async function patch(updates) {
		setSaving(true);
		try {
			const json = await fetchJson(`/api/tasks/${task.id}`, { method: 'PATCH', body: updates });
			if (!json) return false; // 401 → redirected to login
			onUpdate(json.data);
			if (updates.assignee !== undefined) {
				onAssigneeChanged?.({
					assignee: updates.assignee || null,
					notified: json.notified || null,
				});
			}
			return true;
		} catch (err) {
			if (updates.assignee !== undefined) {
				onAssigneeChanged?.({ error: err.message || 'Could not save assignment' });
			}
			return false;
		} finally {
			setSaving(false);
		}
	}

	async function remove() {
		setDeleting(true);
		try {
			await fetchJson(`/api/tasks/${task.id}`, { method: 'DELETE' });
			onDeleted?.(task.id);
			return true;
		} catch {
			return false;
		} finally {
			setDeleting(false);
		}
	}

	return { patch, saving, remove, deleting };
}

function ChecklistLink({ url, label = 'Open checklist' }) {
	if (!url) return <span className="text-xs text-muted">—</span>;
	return (
		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			className="inline-flex items-center justify-center w-8 h-8 border border-border rounded text-muted hover:text-dark hover:bg-gray-50 transition-colors"
			title={label}
			aria-label={label}
		>
			<ListChecks size={16} />
		</a>
	);
}

function TaskTypeBadge({ type }) {
	if (!type || type === 'turnover') return null;
	const { badgeClass } = getTaskTypeStyle(type);
	return (
		<span className={clsx('inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide', badgeClass)}>
			{taskTypeLabel(type)}
		</span>
	);
}

function AssigneeSelect({ value, onChange, disabled, className }) {
	return (
		<div className={clsx('relative min-w-[9rem] max-w-[11rem]', className)}>
			<select
				className="appearance-none bg-transparent border-0 p-0 pr-5 text-sm text-dark cursor-pointer focus:outline-none focus:ring-0 w-full truncate disabled:opacity-60"
				value={value}
				onChange={onChange}
				disabled={disabled}
			>
				<option value="">Unassigned</option>
				{ASSIGNEES.map((a) => <option key={a} value={a}>{a}</option>)}
			</select>
			<ChevronDown size={12} className="absolute right-0 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
		</div>
	);
}

function ChecklistPdfLink({ url }) {
	if (!url) return <span className="text-xs text-muted">—</span>;
	return (
		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			className="inline-flex items-center justify-center w-8 h-8 border border-border rounded text-muted hover:text-dark hover:bg-gray-50 transition-colors"
			title="View PDF"
			aria-label="View PDF"
		>
			<FileText size={16} />
		</a>
	);
}

export function TaskItem({ task, variant, onUpdate, onAssigneeChanged, onSelect, showAdmin, showPaidToggle, readOnly, assigneeReadOnly, isColumnVisible, isCompletedTab }) {
	const { user, navPermissions } = useAuth();
	const showReservationDetails = canViewReservationData(user, navPermissions);
	const displayOptions = { showReservationDetails };
	const { patch, saving } = useTaskActions(task, onUpdate, onAssigneeChanged);
	const isOverdue = taskIsOverdue(task);
	const completed = task.status === 'completed';
	const isCard = variant === 'card';
	const typeStyle = getTaskTypeStyle(task.type);

	function showCol(key) {
		return !isColumnVisible || isColumnVisible(key);
	}

	function setAssignee(value) {
		const assignee = value || null;
		const body = { assignee };
		if (!completed) body.status = statusFromAssignee(assignee);
		patch(body);
	}

	function markComplete() {
		patch({ status: 'completed' });
	}

	const assigneeSelect = (
		<AssigneeSelect
			value={task.assignee || ''}
			onChange={(e) => setAssignee(e.target.value)}
			disabled={saving}
			className={isCard ? 'w-full' : undefined}
		/>
	);

	const adminControl = completed ? (
		<span className={`text-green-700 font-medium ${isCard ? 'text-sm' : 'text-xs'}`}>Completed</span>
	) : (
		<AdminCompleteButton onConfirm={markComplete} disabled={saving} size={isCard ? 'md' : 'sm'} />
	);

	const checklistUrl = isCompletedTab
		? (task.completed_checklist_url || task.checklist_submission_url || task.checklist_url)
		: task.checklist_url;
	const checklistLabel = isCompletedTab ? 'View submitted checklist' : 'Open checklist';

	const openTask = onSelect ? () => onSelect(task) : undefined;
	const stopOpen = (e) => e.stopPropagation();

	if (isCard) {
		return (
			<div
				className={clsx('card p-4 space-y-3 w-full min-w-0', typeStyle.rowClass, openTask && 'cursor-pointer')}
				onClick={openTask}
				onKeyDown={openTask ? (e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						openTask();
					}
				} : undefined}
				role={openTask ? 'button' : undefined}
				tabIndex={openTask ? 0 : undefined}
			>
				<div className="flex items-start gap-3 min-w-0">
					<TaskStatusIndicator task={task} />
					<div className="min-w-0 flex-1">
						<div className="space-y-1">
							<p className="text-sm font-semibold font-mono tracking-wide leading-snug text-dark break-words">
								{taskHeadline(task, displayOptions)}
							</p>
							<TaskTypeBadge type={task.type} />
						</div>
						{(showReservationDetails || taskHasPets(task)) && (
							<p className="text-xs text-muted mt-1 flex items-center gap-1.5">
								{showReservationDetails && (
									<span className="truncate">{taskGuestSubtitle(task, displayOptions)}</span>
								)}
								<TaskPetIndicator task={task} size={13} showReservationDetails={showReservationDetails} />
							</p>
						)}
					</div>
				</div>

				<dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
					<div>
						<dt className="text-xs text-muted">Check-Out</dt>
						<dd className="text-dark">
							{formatDateShort(task.checkout_date || task.due_date)}
							<span className="text-muted text-xs"> · {formatClock(task.start_time || '10:00')}</span>
						</dd>
					</div>
					<div>
						<dt className="text-xs text-muted">Due</dt>
						<dd>
							{showAdmin ? (
								<TaskDueEditor
									task={task}
									onSave={patch}
									saving={saving}
									className="mt-0.5"
								/>
							) : (
								<span className={isOverdue ? 'text-red-600 font-semibold' : 'text-dark'}>
									{formatDateShort(task.due_date)}
									<span className="text-muted text-xs font-normal"> · {formatClock(task.due_time || '16:00')}</span>
								</span>
							)}
						</dd>
					</div>
					{isOverdue && (
						<div className="col-span-2">
							<span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Overdue</span>
						</div>
					)}
					{isCompletedTab && (
						<div>
							<dt className="text-xs text-muted">Paid</dt>
							<dd>
								{showPaidToggle ? (
									<TaskPaidToggle task={task} onSave={patch} saving={saving} />
								) : (
									<TaskPaidIndicator task={task} />
								)}
							</dd>
						</div>
					)}
				</dl>

				<div className="flex items-center gap-2 flex-wrap" onClick={stopOpen}>
					<ChecklistLink url={checklistUrl} label={checklistLabel} />
					{!isCompletedTab && <ChecklistPdfLink url={task.checklist_pdf_url} />}
				</div>

				{showAdmin && (
					<div onClick={stopOpen}>
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
					<div onClick={stopOpen}>
						<label className="label">Assignee</label>
						{assigneeSelect}
					</div>
				)}
			</div>
		);
	}

	return (
		<tr
			className={clsx('hover:bg-gray-50 transition-colors', typeStyle.rowClass, openTask && 'cursor-pointer')}
			onClick={openTask}
		>
			{showCol('status') && (
				<td className="table-cell w-10 px-2">
					<TaskStatusIndicator task={task} />
				</td>
			)}
			{showCol('task') && (
				<td className="table-cell whitespace-normal min-w-[11rem] max-w-[16rem]">
					<div className="min-w-0 space-y-1">
						<div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
							<p className="text-sm font-semibold font-mono tracking-wide text-dark break-words leading-snug">
								{taskHeadline(task, displayOptions)}
							</p>
							<TaskTypeBadge type={task.type} />
						</div>
						{(showReservationDetails || taskHasPets(task)) && (
							<p className="text-xs text-muted flex items-center gap-1.5">
								{showReservationDetails && (
									<span className="truncate">{taskGuestSubtitle(task, displayOptions)}</span>
								)}
								<TaskPetIndicator task={task} size={13} showReservationDetails={showReservationDetails} />
							</p>
						)}
					</div>
				</td>
			)}
			{showCol('checkout') && (
				<td className="table-cell align-top">
					<p className="text-sm text-dark">{formatDateShort(task.checkout_date || task.due_date)}</p>
					<p className="text-xs text-muted">{formatClock(task.start_time || '10:00')}</p>
				</td>
			)}
			{showCol('due') && (
				<td className="table-cell align-top" onClick={showAdmin ? stopOpen : undefined}>
					{showAdmin ? (
						<TaskDueEditor task={task} onSave={patch} saving={saving} compact />
					) : (
						<>
							<p className={`text-sm ${isOverdue ? 'text-red-600 font-semibold' : 'text-dark'}`}>
								{formatDateShort(task.due_date)}
							</p>
							<p className="text-xs text-muted">{formatClock(task.due_time || '16:00')}</p>
							{isOverdue && <span className="text-xs text-red-600 font-medium">Overdue</span>}
						</>
					)}
				</td>
			)}
			{showCol('assignee') && (assigneeReadOnly || !readOnly) && (
				<td className="table-cell align-top" onClick={stopOpen}>
					{assigneeReadOnly
						? <span className="text-sm text-dark">{task.assignee || '—'}</span>
						: assigneeSelect}
				</td>
			)}
			{showCol('paid') && (
				<td className="table-cell align-top" onClick={showPaidToggle && completed ? stopOpen : undefined}>
					{completed ? (
						showPaidToggle ? (
							<TaskPaidToggle task={task} onSave={patch} saving={saving} compact />
						) : (
							<TaskPaidIndicator task={task} />
						)
					) : null}
				</td>
			)}
			{showCol('checklist') && (
				<td className="table-cell" onClick={stopOpen}>
					<ChecklistLink url={checklistUrl} label={checklistLabel} />
				</td>
			)}
			{showCol('pdf') && (
				<td className="table-cell" onClick={stopOpen}>
					<ChecklistPdfLink url={task.checklist_pdf_url} />
				</td>
			)}
			{showCol('admin') && showAdmin && (
				<td className="table-cell" onClick={stopOpen}>{adminControl}</td>
			)}
		</tr>
	);
}
