import { AlertCircle, Circle } from 'lucide-react';
import clsx from 'clsx';
import { getTaskStatusIndicator } from '../lib/constants';

/** Shared text/dot colors per status kind (widgets, row indicators). */
export const STATUS_KIND_COLORS = {
	unassigned: { count: 'text-gray-600', icon: 'text-gray-600' },
	assigned: { count: 'text-yellow-500', icon: 'bg-yellow-500' },
	completed: { count: 'text-green-600', icon: 'bg-green-600' },
	overdue: { count: 'text-red-600', icon: 'text-red-600' },
};

/** Icon for a status kind (used in rows and summary widgets). */
export function StatusKindIcon({ kind, size = 18, className }) {
	const colors = STATUS_KIND_COLORS[kind];
	if (kind === 'overdue') {
		return (
			<span className={clsx('inline-flex', colors?.icon, className)} aria-hidden>
				<AlertCircle size={size} strokeWidth={2.5} />
			</span>
		);
	}
	if (kind === 'unassigned') {
		return (
			<span className={clsx('inline-flex', colors?.icon, className)} aria-hidden>
				<Circle size={size} strokeWidth={2} />
			</span>
		);
	}
	return (
		<span
			className={clsx('inline-block rounded-full', colors?.icon, className)}
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
