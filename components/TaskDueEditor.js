import { useEffect, useState } from 'react';
import clsx from 'clsx';
import DateInput from './DateInput';
import { taskIsOverdue } from '../lib/constants';
import { formatDateShort, formatClock } from '../lib/taskDisplay';

/** Admin-only inline editor for task due date and time. */
export default function TaskDueEditor({
	task,
	onSave,
	saving = false,
	compact = false,
	className,
}) {
	const [editing, setEditing] = useState(false);
	const [dueDate, setDueDate] = useState(task.due_date || '');
	const [dueTime, setDueTime] = useState(task.due_time || '16:00');
	const isOverdue = taskIsOverdue({ ...task, due_date: dueDate });

	useEffect(() => {
		setDueDate(task.due_date || '');
		setDueTime(task.due_time || '16:00');
		setEditing(false);
	}, [task.due_date, task.due_time]);

	function commit() {
		const nextDate = dueDate || null;
		const nextTime = dueTime || '16:00';
		setEditing(false);
		if (nextDate === (task.due_date || null) && nextTime === (task.due_time || '16:00')) return;
		onSave?.({ due_date: nextDate, due_time: nextTime });
	}

	function cancel() {
		setDueDate(task.due_date || '');
		setDueTime(task.due_time || '16:00');
		setEditing(false);
	}

	if (compact && !editing) {
		return (
			<button
				type="button"
				className={clsx('text-left group', className)}
				onClick={(e) => {
					e.stopPropagation();
					setEditing(true);
				}}
				title="Click to edit due date and time"
			>
				<p className={clsx('text-sm', isOverdue ? 'text-red-600 font-semibold' : 'text-dark')}>
					{formatDateShort(task.due_date)}
				</p>
				<p className="text-xs text-muted group-hover:text-dark transition-colors">
					{formatClock(task.due_time || '16:00')}
				</p>
				{isOverdue && <span className="text-xs text-red-600 font-medium">Overdue</span>}
			</button>
		);
	}

	if (compact) {
		return (
			<div className={clsx('space-y-1', className)} onClick={(e) => e.stopPropagation()}>
				<DateInput
					value={dueDate}
					onChange={(e) => setDueDate(e.target.value)}
					onBlur={commit}
					disabled={saving}
					className="input-compact w-full"
					autoFocus
				/>
				<input
					type="time"
					value={dueTime}
					onChange={(e) => setDueTime(e.target.value)}
					onBlur={commit}
					onKeyDown={(e) => { if (e.key === 'Escape') cancel(); }}
					disabled={saving}
					className="input-compact w-full"
				/>
				{isOverdue && <span className="text-xs text-red-600 font-medium">Overdue</span>}
			</div>
		);
	}

	return (
		<div className={clsx('space-y-2', className)} onClick={(e) => e.stopPropagation()}>
			<div className="flex flex-wrap items-center gap-2">
				<DateInput
					value={dueDate}
					onChange={(e) => setDueDate(e.target.value)}
					onBlur={commit}
					disabled={saving}
					className="input-compact"
				/>
				<input
					type="time"
					value={dueTime}
					onChange={(e) => setDueTime(e.target.value)}
					onBlur={commit}
					disabled={saving}
					className="input-compact"
				/>
			</div>
			{isOverdue && (
				<span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
					Overdue
				</span>
			)}
		</div>
	);
}
