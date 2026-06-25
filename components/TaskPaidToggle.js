import clsx from 'clsx';
import { Check, Circle } from 'lucide-react';
import { formatDateOrDash } from '../lib/dates';

/** Admin control to mark a completed task as paid or unpaid. */
export default function TaskPaidToggle({ task, onSave, saving, compact = false, showDate = false }) {
	const paid = Boolean(task?.paid_at);

	async function toggle() {
		await onSave({ paid: !paid });
	}

	const paidTitle = task?.paid_by ? `Paid by ${task.paid_by}` : 'Paid';

	if (compact) {
		return (
			<button
				type="button"
				onClick={toggle}
				disabled={saving}
				className={clsx(
					'inline-flex items-center justify-center rounded p-1 transition-colors disabled:opacity-50',
					paid
						? 'text-green-600 hover:bg-green-50'
						: 'text-muted hover:text-dark hover:bg-gray-100',
				)}
				aria-pressed={paid}
				title={paid ? `${paidTitle} — click to unmark` : 'Mark as paid'}
				aria-label={paid ? `${paidTitle} — click to unmark` : 'Mark as paid'}
			>
				{paid ? <Check size={18} strokeWidth={2.5} aria-hidden /> : <Circle size={18} aria-hidden />}
			</button>
		);
	}

	return (
		<button
			type="button"
			onClick={toggle}
			disabled={saving}
			className={clsx(
				'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50',
				paid
					? 'border-green-200 bg-green-50 text-green-800 hover:bg-green-100'
					: 'border-border bg-white text-dark hover:bg-gray-50',
			)}
			aria-pressed={paid}
		>
			{paid ? <Check size={16} aria-hidden /> : <Circle size={16} className="text-muted" aria-hidden />}
			{paid
				? (showDate && task.paid_at ? `Paid · ${formatDateOrDash(task.paid_at)}` : 'Paid')
				: 'Mark as paid'}
		</button>
	);
}
