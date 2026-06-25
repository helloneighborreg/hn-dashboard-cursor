import { Check } from 'lucide-react';
import { formatDateOrDash } from '../lib/dates';

/** Green checkmark when a task has been marked paid. */
export default function TaskPaidIndicator({ task, showDate = false }) {
	if (!task?.paid_at) {
		return <span className="text-xs text-muted">—</span>;
	}

	const title = task.paid_by ? `Paid by ${task.paid_by}` : 'Paid';
	const dateLabel = showDate ? formatDateOrDash(task.paid_at) : null;
	const ariaLabel = dateLabel ? `${title} on ${dateLabel}` : title;

	return (
		<span
			className="inline-flex items-center gap-1.5 text-green-600"
			title={title}
			aria-label={ariaLabel}
		>
			<Check size={18} strokeWidth={2.5} aria-hidden />
			{dateLabel && (
				<span className="text-xs font-medium text-dark">{dateLabel}</span>
			)}
		</span>
	);
}
