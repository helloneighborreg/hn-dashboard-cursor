import { useState } from 'react';
import clsx from 'clsx';

/**
 * Admin-only control: first click arms confirmation; second click marks complete.
 */
export default function AdminCompleteButton({ onConfirm, disabled, size = 'md' }) {
	const [armed, setArmed] = useState(false);
	const sm = size === 'sm';

	if (armed) {
		return (
			<div className={clsx('flex flex-col gap-1', sm ? 'min-w-[7.5rem]' : 'min-w-[9rem]')}>
				<p className="text-xs font-medium text-amber-800">Mark as complete?</p>
				<div className="flex gap-1">
					<button
						type="button"
						className={clsx(
							'btn-primary flex-1 justify-center',
							sm ? 'text-xs py-1 px-2' : 'text-xs py-1.5 px-2',
						)}
						disabled={disabled}
						onClick={() => {
							setArmed(false);
							onConfirm();
						}}
					>
						Confirm
					</button>
					<button
						type="button"
						className={clsx(
							'btn-secondary flex-1 justify-center',
							sm ? 'text-xs py-1 px-2' : 'text-xs py-1.5 px-2',
						)}
						disabled={disabled}
						onClick={() => setArmed(false)}
					>
						Cancel
					</button>
				</div>
			</div>
		);
	}

	return (
		<button
			type="button"
			className={clsx(
				'btn-secondary whitespace-nowrap',
				sm ? 'text-xs py-1 px-2' : 'text-xs py-1.5 px-2.5',
			)}
			disabled={disabled}
			onClick={() => setArmed(true)}
		>
			Mark complete
		</button>
	);
}
