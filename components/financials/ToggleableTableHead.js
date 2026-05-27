import { Eye, EyeOff } from 'lucide-react';
import clsx from 'clsx';

export function ToggleableTableHead({ label, onHide, align = 'left', className }) {
	return (
		<th
			className={clsx(
				'table-head table-head-sticky',
				align === 'right' && 'text-right',
				className,
			)}
		>
			<span className={clsx('inline-flex items-center gap-1.5 group', align === 'right' && 'justify-end w-full')}>
				<span>{label}</span>
				<button
					type="button"
					onClick={onHide}
					className="opacity-40 group-hover:opacity-100 focus:opacity-100 p-0.5 rounded hover:bg-gray-200 text-muted hover:text-dark transition-opacity"
					title={`Hide ${label} column`}
					aria-label={`Hide ${label} column`}
				>
					<EyeOff size={12} />
				</button>
			</span>
		</th>
	);
}

export function HiddenColumnsBar({ columns, labels, onShow }) {
	if (!columns.length) return null;

	return (
		<div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
			<span className="text-muted">Hidden columns:</span>
			{columns.map((key) => (
				<button
					key={key}
					type="button"
					onClick={() => onShow(key)}
					className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-muted hover:bg-gray-200 hover:text-dark transition-colors"
				>
					<Eye size={11} />
					{labels[key] || key}
				</button>
			))}
		</div>
	);
}
