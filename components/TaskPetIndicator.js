import { Cat } from 'lucide-react';
import clsx from 'clsx';
import { taskHasPets, taskPetLabel } from '../lib/reservationPets';

export default function TaskPetIndicator({ task, className, size = 14, showLabel = true }) {
	if (!taskHasPets(task)) return null;

	return (
		<span
			className={clsx(
				'inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 flex-shrink-0',
				showLabel ? 'text-xs font-medium px-1.5 py-0.5' : 'text-amber-600',
				className,
			)}
			title={taskPetLabel(task)}
			aria-label={taskPetLabel(task)}
		>
			<Cat size={size} strokeWidth={2.25} aria-hidden />
			{showLabel && <span>Pet</span>}
		</span>
	);
}
