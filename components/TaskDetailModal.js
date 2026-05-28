import { X, Home, CalendarDays, Clock, User, FileText, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import { formatTaskStatus, getTaskStatusIndicator, taskIsOverdue } from '../lib/constants';
import {
	taskHeadline,
	taskGuestSubtitle,
	formatDateShort,
	formatClock,
} from '../lib/taskDisplay';
import TaskStatusIndicator from './TaskStatusIndicator';

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

export default function TaskDetailModal({ task, onClose, showAssignee = false }) {
	if (!task) return null;

	const { label: statusLabel } = getTaskStatusIndicator(task);
	const isOverdue = taskIsOverdue(task);

	return (
		<>
			<div
				className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
				onClick={onClose}
			/>
			<div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col overflow-hidden">
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
						className="text-muted hover:text-dark p-1 rounded-lg hover:bg-gray-100 flex-shrink-0"
					>
						<X size={18} />
					</button>
				</div>

				<div className="flex-1 overflow-y-auto p-5 space-y-5">
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
						{task.notes?.trim() && (
							<DetailRow icon={FileText} label="Notes" value={task.notes.trim()} />
						)}
					</div>
				</div>

				<div className="p-4 border-t border-border space-y-2">
					{task.checklist_url && (
						<a
							href={task.checklist_url}
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center justify-center gap-2 w-full btn-primary text-sm"
						>
							<ExternalLink size={14} />
							Open Checklist
						</a>
					)}
					{task.checklist_pdf_url && (
						<a
							href={task.checklist_pdf_url}
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center justify-center gap-2 w-full btn-secondary text-sm"
						>
							<ExternalLink size={14} />
							View Completed Checklist
						</a>
					)}
				</div>
			</div>
		</>
	);
}
