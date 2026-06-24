import { useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, ListChecks, FileText } from 'lucide-react';
import { ASSIGNEES, statusFromAssignee, taskIsOverdue } from '../lib/constants';
import { fetchJson } from '../lib/apiClient';
import { taskHeadline, taskGuestSubtitle, formatDateShort, formatClock } from '../lib/taskDisplay';
import TaskStatusIndicator from './TaskStatusIndicator';
import TaskCleanerStatus from './TaskCleanerStatus';
import AdminCompleteButton from './AdminCompleteButton';
import TaskPetIndicator from './TaskPetIndicator';

export function useTaskActions(task, onUpdate, onAssigneeChanged) {
	const [saving, setSaving] = useState(false);

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

	return { patch, saving };
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

function AssigneePicker({ task, isCard, saving, onChange }) {
	const assigned = Boolean(task.assignee);
	const options = (
		<>
			{!assigned && <option value="">Unassigned</option>}
			{ASSIGNEES.map((a) => <option key={a} value={a}>{a}</option>)}
			{assigned && <option value="">Unassigned</option>}
		</>
	);

	if (!assigned) {
		return (
			<select
				className={isCard ? 'select text-sm w-full text-muted' : 'select text-xs py-1 w-44 text-muted'}
				value=""
				onChange={(e) => onChange(e.target.value)}
				disabled={saving}
			>
				{options}
			</select>
		);
	}

	return (
		<div
			className={clsx(
				'relative inline-flex max-w-full items-center rounded-full bg-brand-50 font-medium text-brand-700',
				isCard ? 'text-sm px-3 py-1.5' : 'text-xs px-2.5 py-1',
			)}
		>
			<select
				className={clsx(
					'appearance-none cursor-pointer border-0 bg-transparent p-0 pr-5 font-medium text-brand-700',
					'focus:outline-none focus:ring-0',
					isCard ? 'text-sm w-full min-w-0' : 'text-xs max-w-[10rem]',
				)}
				value={task.assignee}
				onChange={(e) => onChange(e.target.value)}
				disabled={saving}
			>
				{options}
			</select>
			<ChevronDown
				size={isCard ? 14 : 12}
				className="pointer-events-none absolute right-2 shrink-0 opacity-60"
				aria-hidden
			/>
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

export function TaskItem({ task, variant, onUpdate, onAssigneeChanged, onSelect, showAdmin, readOnly, assigneeReadOnly, isColumnVisible, isCompletedTab, showCleanerStatus }) {
	const { patch, saving } = useTaskActions(task, onUpdate, onAssigneeChanged);
	const isOverdue = taskIsOverdue(task);
	const completed = task.status === 'completed';
	const underReview = task.status === 'under_review';
	const isCard = variant === 'card';

	function showCol(key) {
		return !isColumnVisible || isColumnVisible(key);
	}

	function setAssignee(value) {
		const assignee = value || null;
		const body = { assignee };
		if (!completed && !underReview) body.status = statusFromAssignee(assignee);
		patch(body);
	}

	function markComplete() {
		patch({ status: 'completed' });
	}

	const assigneeSelect = (
		<AssigneePicker
			task={task}
			isCard={isCard}
			saving={saving}
			onChange={setAssignee}
		/>
	);

	const adminControl = completed ? (
		<span className={`text-green-700 font-medium ${isCard ? 'text-sm' : 'text-xs'}`}>Completed</span>
	) : underReview ? (
		<AdminCompleteButton
			onConfirm={markComplete}
			disabled={saving}
			size={isCard ? 'md' : 'sm'}
			label="Approve task"
			confirmPrompt="Approve checklist?"
		/>
	) : (
		<AdminCompleteButton onConfirm={markComplete} disabled={saving} size={isCard ? 'md' : 'sm'} />
	);

	const checklistUrl = (isCompletedTab || underReview) ? (task.completed_checklist_url || task.checklist_submission_url || task.checklist_url) : task.checklist_url;
	const checklistLabel = (isCompletedTab || underReview) ? 'View submitted checklist' : 'Open checklist';

	const openTask = onSelect ? () => onSelect(task) : undefined;
	const stopOpen = (e) => e.stopPropagation();

	if (isCard) {
		return (
			<div
				className={clsx('card p-4 space-y-3 w-full min-w-0', openTask && 'cursor-pointer')}
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
						<p className="text-sm font-semibold font-mono tracking-wide leading-snug text-dark">
							{taskHeadline(task)}
						</p>
						<p className="text-xs text-muted mt-1 flex items-center gap-1.5">
							<span className="truncate">{taskGuestSubtitle(task)}</span>
							<TaskPetIndicator task={task} size={13} />
						</p>
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
					{showCleanerStatus && (
						<div className="col-span-2">
							<TaskCleanerStatus task={task} />
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
			className={clsx('hover:bg-gray-50 transition-colors', openTask && 'cursor-pointer')}
			onClick={openTask}
		>
			{showCol('status') && (
				<td className="table-cell w-10 px-2">
					<TaskStatusIndicator task={task} />
				</td>
			)}
			{showCol('task') && (
				<td className="table-cell">
					<div className="min-w-0">
						<p className="text-sm font-semibold font-mono tracking-wide text-dark">
							{taskHeadline(task)}
						</p>
						<p className="text-xs text-muted mt-0.5 flex items-center gap-1.5">
							<span className="truncate">{taskGuestSubtitle(task)}</span>
							<TaskPetIndicator task={task} size={13} />
						</p>
						{showCleanerStatus && <TaskCleanerStatus task={task} className="mt-2" />}
					</div>
				</td>
			)}
			{showCol('checkout') && (
				<td className="table-cell">
					<p className="text-sm text-dark">{formatDateShort(task.checkout_date || task.due_date)}</p>
					<p className="text-xs text-muted">{formatClock(task.start_time || '10:00')}</p>
				</td>
			)}
			{showCol('due') && (
				<td className="table-cell">
					<p className={`text-sm ${isOverdue ? 'text-red-600 font-semibold' : 'text-dark'}`}>
						{formatDateShort(task.due_date)}
					</p>
					<p className="text-xs text-muted">{formatClock(task.due_time || '16:00')}</p>
					{isOverdue && <span className="text-xs text-red-600 font-medium">Overdue</span>}
				</td>
			)}
			{showCol('assignee') && (assigneeReadOnly || !readOnly) && (
				<td className="table-cell" onClick={stopOpen}>
					{assigneeReadOnly
						? <span className="text-sm text-dark">{task.assignee || '—'}</span>
						: assigneeSelect}
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
