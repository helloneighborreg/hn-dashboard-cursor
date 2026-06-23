import clsx from 'clsx';

/** Compact two-option toggle (e.g. All / Unassigned). */
export default function SegmentedToggle({ value, onChange, options }) {
	return (
		<div
			className="inline-flex max-w-full overflow-x-auto rounded-lg border border-border bg-gray-50 p-0.5 text-xs"
			role="group"
		>
			{options.map((opt) => (
				<button
					key={opt.value}
					type="button"
					onClick={() => onChange(opt.value)}
					className={clsx(
						'px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap',
						value === opt.value
							? 'bg-white text-dark shadow-sm'
							: 'text-muted hover:text-dark',
					)}
				>
					{opt.label}
				</button>
			))}
		</div>
	);
}
