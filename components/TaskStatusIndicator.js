import { AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import { getTaskStatusIndicator } from '../lib/constants';

const DOT_CLASS = {
	completed: 'bg-green-500',
	assigned: 'bg-yellow-400',
	unassigned: 'bg-red-500',
};

/** Icon for a status kind (used in rows and summary widgets). */
export function StatusKindIcon({ kind, size = 18, className }) {
	if (kind === 'overdue') {
		return (
			<span className={clsx('inline-flex text-red-600', className)} aria-hidden>
				<AlertCircle size={size} strokeWidth={2.5} />
			</span>
		);
	}
	return (
		<span
			className={clsx('inline-block rounded-full', DOT_CLASS[kind], className)}
			style={{ width: size * 0.78, height: size * 0.78 }}
			aria-hidden
		/>
	);
}

/** Status dot (red / yellow / green) or red exclamation when overdue. */
export default function TaskStatusIndicator({ task, className }) {
	const { kind, label } = getTaskStatusIndicator(task);
	return (
		<span className={className} title={label} aria-label={label}>
			<StatusKindIcon kind={kind} />
		</span>
	);
}
