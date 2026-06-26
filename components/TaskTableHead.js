import clsx from 'clsx';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

/** Table header with optional sort control and admin column-hide on label click. */
export default function TaskTableHead({
	label,
	sortKey,
	active = false,
	direction = 'asc',
	onSort,
	onHide,
	align = 'left',
	className,
	compact = false,
	sortable = true,
}) {
	const sortIcon = sortable && (
		<button
			type="button"
			onClick={() => onSort?.(sortKey)}
			className={clsx(
				'inline-flex items-center justify-center rounded p-0.5 shrink-0',
				'text-muted hover:text-dark hover:bg-gray-100 transition-colors',
				active && 'text-dark',
			)}
			aria-label={`Sort by ${label}`}
			aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
		>
			{active ? (
				direction === 'asc'
					? <ArrowUp size={12} aria-hidden />
					: <ArrowDown size={12} aria-hidden />
			) : (
				<ArrowUpDown size={12} className="opacity-40" aria-hidden />
			)}
		</button>
	);

	const labelEl = onHide ? (
		<button
			type="button"
			onClick={onHide}
			className={clsx(
				'text-xs font-semibold text-muted uppercase tracking-wide truncate shrink min-w-0',
				'hover:text-dark transition-colors text-left',
				compact && 'sr-only',
			)}
			title={`Hide ${label} column`}
		>
			{label}
		</button>
	) : (
		<span className={clsx(
			'text-xs font-semibold text-muted uppercase tracking-wide truncate shrink min-w-0',
			compact && 'sr-only',
		)}>
			{label}
		</span>
	);

	if (!sortable) {
		return (
			<th
				className={clsx(
					'table-head table-head-sticky',
					align === 'right' && 'text-right',
					align === 'center' && 'text-center',
					compact ? 'w-10 px-2' : undefined,
					className,
				)}
			>
				{compact ? <span className="sr-only">{label}</span> : labelEl}
			</th>
		);
	}

	return (
		<th
			className={clsx(
				'table-head table-head-sticky p-0',
				align === 'right' && 'text-right',
				align === 'center' && 'text-center',
				compact ? 'w-10' : undefined,
				className,
			)}
		>
			<div
				className={clsx(
					'flex items-center min-w-0 whitespace-nowrap',
					compact ? 'justify-center gap-0.5 px-2 py-2.5' : 'gap-2 px-4 py-2.5',
					align === 'right' && 'justify-end',
					align === 'center' && 'justify-center',
				)}
			>
				{labelEl}
				{sortIcon}
			</div>
		</th>
	);
}
