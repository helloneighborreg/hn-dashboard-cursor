import { useMemo, useState } from 'react';
import Link from 'next/link';
import { X, Home, CalendarDays, Clock, User, FileText, ExternalLink, Cat, UserCircle, Trash2, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { taskIsOverdue } from '../lib/constants';
import {
	taskHeadline,
	taskGuestSubtitle,
	formatDateShort,
	formatClock,
} from '../lib/taskDisplay';
import { taskHasPets, taskPetLabel } from '../lib/reservationPets';
import { getTaskTypeStyle, taskTypeLabel } from '../lib/taskTypeStyles';
import { taskScheduledByLabel } from '../lib/taskHistory';
import { useEscapeKey } from '../lib/useEscapeKey';
import { useFocusTrap } from '../lib/useFocusTrap';
import TaskStatusIndicator from './TaskStatusIndicator';
import TaskPetIndicator from './TaskPetIndicator';
import TaskTimeline from './TaskTimeline';
import TaskDueEditor from './TaskDueEditor';
import TaskPaidToggle from './TaskPaidToggle';
import TaskPaidIndicator from './TaskPaidIndicator';
import { useTaskActions } from './TaskItem';
import { useAuth } from './AuthContext';
import { canViewReservationData } from '../lib/roles';
import { getTaskChecklistHref } from '../lib/checklistUrl';

function DetailRow({ icon: Icon, label, value, mono, highlight, children }) {
	const content = children ?? value;
	return (
		<div className="flex items-start gap-3">
			<div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
				<Icon size={14} className="text-muted" />
			</div>
			<div className="min-w-0">
				<p className="text-xs text-muted leading-none mb-0.5">{label}</p>
				{children ? (
					<div>{children}</div>
				) : (
					<p className={clsx(
						'text-sm leading-snug break-words',
						highlight ? 'text-red-600 font-semibold' : 'text-dark font-medium',
						mono && 'font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded inline-block',
					)}>
						{content || '—'}
					</p>
				)}
			</div>
		</div>
	);
}

export default function TaskDetailModal({ task, onClose, onUpdate, onDeleted, showAssignee = false }) {
	useEscapeKey(onClose);
	const dialogRef = useFocusTrap();
	const { user, navPermissions } = useAuth();
	const showReservationDetails = canViewReservationData(user, navPermissions);
	const { patch, saving, remove, deleting } = useTaskActions(task, onUpdate, undefined, onDeleted);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [deleteError, setDeleteError] = useState('');
	const openChecklistUrl = useMemo(
		() => (task ? getTaskChecklistHref(task, { completed: false }) : null),
		[task],
	);
	const completedChecklistUrl = useMemo(
		() => (task ? getTaskChecklistHref(task, { completed: true }) : null),
		[task],
	);
	const needsPhotoReview = task?.checklist_review_status === 'needs_review';

	async function handleApprovePhotoReview() {
		await patch({ checklist_review_status: 'approved' });
	}

	async function handleDelete() {
		setDeleteError('');
		const ok = await remove();
		if (ok) {
			onClose?.();
		} else {
			setDeleteError('Could not delete task');
			setConfirmDelete(false);
		}
	}

	if (!task) return null;

	const isOverdue = taskIsOverdue(task);
	const typeStyle = getTaskTypeStyle(task.type);

	return (
		<>
			<div
				className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
				onClick={onClose}
			/>
			<div
				ref={dialogRef}
				tabIndex={-1}
				role="dialog"
				aria-modal="true"
				aria-label={`Task: ${taskHeadline(task)}`}
				className={clsx(
					'fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col overflow-hidden focus:outline-none',
					typeStyle.rowClass,
				)}
			>
				<div className="flex items-center justify-between px-5 py-4 border-b border-border">
					<div className="flex items-center gap-3 min-w-0">
						<TaskStatusIndicator task={task} />
						<div className="min-w-0">
							<p className="font-semibold text-dark text-sm leading-snug truncate font-mono">
								{taskHeadline(task, { showReservationDetails })}
							</p>
							{showReservationDetails && (
								<p className="text-xs text-muted truncate">{taskGuestSubtitle(task)}</p>
							)}
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close"
						className="text-muted hover:text-dark p-1 rounded-lg hover:bg-gray-100 flex-shrink-0"
					>
						<X size={18} />
					</button>
				</div>

				<div className="flex-1 overflow-y-auto p-5 space-y-5">
					<div className="flex items-center gap-2 flex-wrap">
						{task.type && task.type !== 'other' && (
							<span className={clsx('inline-flex px-2 py-0.5 rounded-full text-xs font-semibold', typeStyle.badgeClass)}>
								{taskTypeLabel(task.type)}
							</span>
						)}
						{isOverdue && (
							<span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
								Overdue
							</span>
						)}
						{showAssignee && needsPhotoReview && (
							<span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full">
								<AlertTriangle size={12} />
								Photo review needed
							</span>
						)}
					</div>

					<div className="space-y-3">
						<DetailRow icon={Home} label="Property" value={task.property_name} />
						<DetailRow
							icon={CalendarDays}
							label="Check-Out"
							value={`${formatDateShort(task.checkout_date || task.due_date)} · ${formatClock(task.start_time || '10:00')}`}
						/>
						<DetailRow icon={Clock} label="Due" highlight={isOverdue && !showAssignee}>
							{showAssignee ? (
								<TaskDueEditor task={task} onSave={patch} saving={saving} />
							) : (
								<p className={clsx('text-sm leading-snug', isOverdue ? 'text-red-600 font-semibold' : 'text-dark font-medium')}>
									{`${formatDateShort(task.due_date)} · ${formatClock(task.due_time || '16:00')}`}
								</p>
							)}
						</DetailRow>
						{showAssignee && task.assignee && (
							<DetailRow icon={User} label="Assignee" value={task.assignee} />
						)}
						{showAssignee && (
							<DetailRow
								icon={UserCircle}
								label="Scheduled by"
								value={taskScheduledByLabel(task) || '—'}
							/>
						)}
						{task.status === 'completed' && (
							<DetailRow icon={FileText} label="Payment">
								{showAssignee ? (
									<TaskPaidToggle task={task} onSave={patch} saving={saving} showDate />
								) : (
									<TaskPaidIndicator task={task} showDate />
								)}
							</DetailRow>
						)}
						{task.type && task.type !== 'other' && !showAssignee && (
							<DetailRow icon={FileText} label="Type" value={task.type.replace(/_/g, ' ')} />
						)}
						{(showReservationDetails && (task.guest_name || task.description)?.trim()) && (
							<DetailRow icon={FileText} label="Guest" value={(task.guest_name || task.description).trim()} />
						)}
						{taskHasPets(task) && (
							<DetailRow
								icon={Cat}
								label="Notes"
								value={
									<span className="inline-flex items-center gap-1.5">
										<TaskPetIndicator task={task} size={16} showReservationDetails={showReservationDetails} />
										<span>{taskPetLabel(task, { showReservationDetails })}</span>
									</span>
								}
							/>
						)}
						{task.notes?.trim() && (
							<DetailRow icon={FileText} label={taskHasPets(task) ? 'Other notes' : 'Notes'} value={task.notes.trim()} />
						)}
					</div>

					<TaskTimeline task={task} />
				</div>

				<div className="p-4 border-t border-border space-y-2">
					{showAssignee && onDeleted && (
						confirmDelete ? (
							<div className="space-y-2">
								<p className="text-sm text-amber-800">Delete this task? This cannot be undone.</p>
								<div className="flex gap-2">
									<button
										type="button"
										onClick={() => setConfirmDelete(false)}
										disabled={deleting}
										className="btn-secondary flex-1 justify-center text-sm"
									>
										Cancel
									</button>
									<button
										type="button"
										onClick={handleDelete}
										disabled={deleting}
										className={clsx('btn-danger flex-1 justify-center text-sm', deleting && 'opacity-60')}
									>
										{deleting ? 'Deleting…' : 'Delete'}
									</button>
								</div>
							</div>
						) : (
							<button
								type="button"
								onClick={() => setConfirmDelete(true)}
								className="btn-secondary w-full text-sm gap-2 inline-flex items-center justify-center text-red-600 hover:text-red-700 hover:bg-red-50"
							>
								<Trash2 size={14} />
								Delete task
							</button>
						)
					)}
					{deleteError && <p className="text-red-600 text-sm">{deleteError}</p>}
					{openChecklistUrl && task.status !== 'completed' && (
						openChecklistUrl.startsWith('/') ? (
							<Link
								href={openChecklistUrl}
								className="flex items-center justify-center gap-2 w-full btn-primary text-sm"
							>
								<ExternalLink size={14} />
								Open Checklist
							</Link>
						) : (
							<a
								href={openChecklistUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center justify-center gap-2 w-full btn-primary text-sm"
							>
								<ExternalLink size={14} />
								Open Checklist
							</a>
						)
					)}
					{showAssignee && needsPhotoReview && (
						<button
							type="button"
							onClick={handleApprovePhotoReview}
							disabled={saving}
							className="flex items-center justify-center gap-2 w-full btn-secondary text-sm text-amber-800 border-amber-200 bg-amber-50 hover:bg-amber-100"
						>
							<AlertTriangle size={14} />
							{saving ? 'Saving…' : 'Mark photo review complete'}
						</button>
					)}
					{completedChecklistUrl && task.status === 'completed' && (
						completedChecklistUrl.startsWith('/') ? (
							<Link
								href={completedChecklistUrl}
								className="flex items-center justify-center gap-2 w-full btn-secondary text-sm"
							>
								<ExternalLink size={14} />
								View Completed Checklist
							</Link>
						) : (
							<a
								href={completedChecklistUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center justify-center gap-2 w-full btn-secondary text-sm"
							>
								<ExternalLink size={14} />
								View Completed Checklist
							</a>
						)
					)}
					{task.checklist_pdf_url && (
						<a
							href={task.checklist_pdf_url}
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center justify-center gap-2 w-full btn-secondary text-sm"
						>
							<ExternalLink size={14} />
							View PDF
						</a>
					)}
				</div>
			</div>
		</>
	);
}
