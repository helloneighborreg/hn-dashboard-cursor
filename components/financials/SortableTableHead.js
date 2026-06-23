import clsx from 'clsx';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

export function SortableTableHead({
	label,
	sortKey,
	active = false,
	direction = 'asc',
	onSort,
	align = 'left',
	className,
	compact = false,
	sortable = true,
}) {
	const content = (
		<>
			{compact ? <span className="sr-only">{label}</span> : label}
			{sortable && (
				<span className="inline-flex shrink-0 ml-1 align-middle">
					{active ? (
						direction === 'asc'
							? <ArrowUp size={12} aria-hidden />
							: <ArrowDown size={12} aria-hidden />
					) : (
						<ArrowUpDown size={12} className="opacity-35" aria-hidden />
					)}
				</span>
			)}
		</>
	);

	if (!sortable) {
		return (
			<th
				className={clsx(
					'table-head table-head-sticky',
					align === 'right' && 'text-right',
					compact ? 'w-10 px-2' : undefined,
					className,
				)}
			>
				{content}
			</th>
		);
	}

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
				onClick={() => onSort?.(sortKey)}
				className={clsx(
					'inline-flex items-center gap-0.5 w-full text-xs font-semibold text-muted uppercase tracking-wide',
					'hover:text-dark transition-colors',
					active && 'text-dark',
					compact ? 'px-2 py-2.5 justify-center' : 'px-4 py-2.5',
					align === 'right' ? 'justify-end text-right' : 'justify-start text-left',
				)}
				aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
			>
				{content}
			</button>
		</th>
	);
}
