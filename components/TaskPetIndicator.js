import { Cat } from 'lucide-react';
import clsx from 'clsx';
import { taskHasPets, taskPetLabel } from '../lib/reservationPets';

export default function TaskPetIndicator({ task, className, size = 14 }) {
	if (!taskHasPets(task)) return null;

	return (
		<span
			className={clsx('inline-flex items-center text-amber-600 flex-shrink-0', className)}
			title={taskPetLabel(task)}
			aria-label={taskPetLabel(task)}
		>
			<Cat size={size} strokeWidth={2.25} aria-hidden />
		</span>
	);
}
