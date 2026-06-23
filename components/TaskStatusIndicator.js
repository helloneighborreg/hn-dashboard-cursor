import { AlertCircle, Circle } from 'lucide-react';
import clsx from 'clsx';
import { getTaskStatusIndicator } from '../lib/constants';

const DOT_CLASS = {
	completed: 'bg-green-500',
	assigned: 'bg-yellow-400',
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
	if (kind === 'unassigned') {
		return (
			<span className={clsx('inline-flex text-gray-400', className)} aria-hidden>
				<Circle size={size} strokeWidth={2} />
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

/** Status dot (open circle / yellow / green) or red exclamation when overdue. */
export default function TaskStatusIndicator({ task, className }) {
	const { kind, label } = getTaskStatusIndicator(task);
	return (
		<span className={className} title={label} aria-label={label}>
			<StatusKindIcon kind={kind} />
		</span>
	);
}
