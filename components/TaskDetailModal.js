import { useState } from 'react';
import { X, Home, CalendarDays, Clock, User, FileText, ExternalLink, Cat, Zap } from 'lucide-react';
import clsx from 'clsx';
import { formatTaskStatus, getCleanerTaskStatusMessage, getTaskStatusIndicator, taskIsOverdue } from '../lib/constants';
import {
	taskHeadline,
	taskGuestSubtitle,
	formatDateShort,
	formatClock,
} from '../lib/taskDisplay';
import { taskHasPets, taskPetLabel } from '../lib/reservationPets';
import { fetchJson } from '../lib/apiClient';
import { useEscapeKey } from '../lib/useEscapeKey';
import { useFocusTrap } from '../lib/useFocusTrap';
import { externalLinkProps } from '../lib/linkTarget';
import TaskStatusIndicator from './TaskStatusIndicator';
import TaskCleanerStatus from './TaskCleanerStatus';
import TaskPetIndicator from './TaskPetIndicator';

function DetailRow({ icon: Icon, label, value, mono, highlight }) {
	return (
		<div className="flex items-start gap-3">
			<div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
				<Icon size={14} className="text-muted" />
			</div>
			<div className="min-w-0">
				<p className="text-xs text-muted leading-none mb-0.5">{label}</p>
				<p className={clsx(
					'text-sm leading-snug break-words',
					highlight ? 'text-red-600 font-semibold' : 'text-dark font-medium',
					mono && 'font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded inline-block',
				)}>
					{value || '—'}
				</p>
			</div>
		</div>
	);
}

export default function TaskDetailModal({ task, onClose, showAssignee = false, showAdmin = false, forCleaner = false, onTaskUpdated }) {
	const [webhookTesting, setWebhookTesting] = useState(false);
	const [webhookResult, setWebhookResult] = useState(null);
	useEscapeKey(onClose);
	const dialogRef = useFocusTrap();

	if (!task) return null;

	const { label: statusLabel } = getTaskStatusIndicator(task);
	const cleanerStatus = forCleaner ? getCleanerTaskStatusMessage(task) : null;
	const isOverdue = taskIsOverdue(task);

	async function handleTestWebhook() {
		setWebhookTesting(true);
		setWebhookResult(null);
		try {
			const json = await fetchJson(`/api/tasks/${task.id}/test-fillout-webhook`, { method: 'POST' });
			if (!json) return; // 401 → redirected to login
			setWebhookResult({ type: 'success', message: json.message || 'Webhook test succeeded' });
			if (json.data && onTaskUpdated) onTaskUpdated(json.data);
		} catch (err) {
			setWebhookResult({ type: 'error', message: err.message || 'Webhook test failed' });
		} finally {
			setWebhookTesting(false);
		}
	}

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
				className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col overflow-hidden focus:outline-none"
			>
				<div className="flex items-center justify-between px-5 py-4 border-b border-border">
					<div className="flex items-center gap-3 min-w-0">
						<TaskStatusIndicator task={task} />
						<div className="min-w-0">
							<p className="font-semibold text-dark text-sm leading-snug truncate font-mono">
								{taskHeadline(task)}
							</p>
							<p className="text-xs text-muted truncate">{taskGuestSubtitle(task)}</p>
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
					{cleanerStatus && (
						<div className="rounded-lg border border-border bg-gray-50 p-3">
							<TaskCleanerStatus task={task} />
						</div>
					)}
					<div className="flex items-center gap-2 flex-wrap">
						<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-dark capitalize">
							{formatTaskStatus(task.status)}
						</span>
						{isOverdue && (
							<span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
								Overdue
							</span>
						)}
						<span className="text-xs text-muted">{statusLabel}</span>
					</div>

					<div className="space-y-3">
						<DetailRow icon={Home} label="Property" value={task.property_name} />
						<DetailRow
							icon={CalendarDays}
							label="Check-out"
							value={`${formatDateShort(task.checkout_date || task.due_date)} · ${formatClock(task.start_time || '10:00')}`}
						/>
						<DetailRow
							icon={Clock}
							label="Due"
							value={`${formatDateShort(task.due_date)} · ${formatClock(task.due_time || '16:00')}`}
							highlight={isOverdue}
						/>
						{showAssignee && task.assignee && (
							<DetailRow icon={User} label="Assignee" value={task.assignee} />
						)}
						{task.type && task.type !== 'other' && (
							<DetailRow icon={FileText} label="Type" value={task.type.replace(/_/g, ' ')} />
						)}
						{task.description?.trim() && (
							<DetailRow icon={FileText} label="Description" value={task.description.trim()} />
						)}
						{taskHasPets(task) && (
							<DetailRow
								icon={Cat}
								label="Notes"
								value={
									<span className="inline-flex items-center gap-1.5">
										<TaskPetIndicator task={task} size={16} />
										<span>{taskPetLabel(task)}</span>
									</span>
								}
							/>
						)}
						{task.notes?.trim() && (
							<DetailRow icon={FileText} label={taskHasPets(task) ? 'Other notes' : 'Notes'} value={task.notes.trim()} />
						)}
					</div>
				</div>

				<div className="p-4 border-t border-border space-y-2">
					{task.checklist_url && !['completed', 'under_review'].includes(task.status) && (
						<a
							href={task.checklist_url}
							className="flex items-center justify-center gap-2 w-full btn-primary text-sm"
							{...externalLinkProps(task.checklist_url)}
						>
							<ExternalLink size={14} />
							Open Checklist
						</a>
					)}
					{task.completed_checklist_url && (
						<a
							href={task.completed_checklist_url}
							className="flex items-center justify-center gap-2 w-full btn-secondary text-sm"
							{...externalLinkProps(task.completed_checklist_url)}
						>
							<ExternalLink size={14} />
							View Completed Checklist
						</a>
					)}
					{task.checklist_pdf_url && (
						<a
							href={task.checklist_pdf_url}
							className="flex items-center justify-center gap-2 w-full btn-secondary text-sm"
							{...externalLinkProps(task.checklist_pdf_url)}
						>
							<ExternalLink size={14} />
							View PDF
						</a>
					)}
					{showAdmin && (
						<div className="pt-2 border-t border-border space-y-2">
							<p className="text-xs text-muted leading-snug">
								Simulates Fillout&apos;s completion webhook (TaskID + ReservationID + Notion id).
								{task.status !== 'completed' && ' Assigned tasks will be marked completed.'}
							</p>
							<button
								type="button"
								onClick={handleTestWebhook}
								disabled={webhookTesting}
								className="flex items-center justify-center gap-2 w-full btn-secondary text-sm disabled:opacity-50"
							>
								<Zap size={14} />
								{webhookTesting ? 'Testing…' : 'Test Fillout webhook'}
							</button>
							{webhookResult && (
								<p className={clsx(
									'text-xs leading-snug',
									webhookResult.type === 'success' ? 'text-green-700' : 'text-red-600',
								)}>
									{webhookResult.message}
								</p>
							)}
						</div>
					)}
				</div>
			</div>
		</>
	);
}
