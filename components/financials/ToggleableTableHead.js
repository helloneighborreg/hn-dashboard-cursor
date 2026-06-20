import { Eye } from 'lucide-react';
import clsx from 'clsx';

export function ToggleableTableHead({ label, onHide, align = 'left', className, compact = false }) {
	return (
		<th
			className={clsx(
				'table-head table-head-sticky p-0',
				align === 'right' && 'text-right',
				compact ? 'w-10' : undefined,
				className,
			)}
		>
			<button
				type="button"
				onClick={onHide}
				className={clsx(
					'w-full text-xs font-semibold text-muted uppercase tracking-wide',
					'hover:text-dark transition-colors',
					compact ? 'px-2 py-2.5' : 'px-4 py-2.5',
					align === 'right' ? 'text-right' : 'text-left',
				)}
				title={`Hide ${label} column`}
				aria-label={`Hide ${label} column`}
			>
				{compact ? <span className="sr-only">{label}</span> : label}
			</button>
		</th>
	);
}

export function HiddenColumnsBar({ columns, labels, onShow, hint = 'Click a column name to hide it.' }) {
	if (!hint && columns.length === 0) return null;

	return (
		<div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3 px-4 pt-4 text-xs text-muted">
			{hint && <span>{hint}</span>}
			{hint && columns.length > 0 && <span aria-hidden="true">·</span>}
			{columns.length > 0 && (
				<>
					<span className="text-dark/70">Hidden columns:</span>
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
				</>
			)}
		</div>
	);
}
