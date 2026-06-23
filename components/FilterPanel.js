import { useState } from 'react';
import { ChevronDown, Filter } from 'lucide-react';
import clsx from 'clsx';

export function FilterField({ label, children, className }) {
	return (
		<div className={clsx('min-w-0', className)}>
			<label className="label mb-0.5">{label}</label>
			{children}
		</div>
	);
}

export default function FilterPanel({
	children,
	summary,
	activeCount = 0,
	defaultOpen = false,
}) {
	const [open, setOpen] = useState(defaultOpen || activeCount > 0);

	return (
		<div className="card mb-3 overflow-hidden">
			<button
				type="button"
				onClick={() => setOpen((prev) => !prev)}
				className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-50 transition-colors"
				aria-expanded={open}
			>
				<Filter size={14} className="text-muted flex-shrink-0" />
				<span className="text-sm font-medium text-dark">Filters</span>
				{!open && summary && (
					<span className="text-xs text-muted truncate hidden sm:inline">{summary}</span>
				)}
				{activeCount > 0 && (
					<span className="text-xs bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full flex-shrink-0">
						{activeCount}
					</span>
				)}
				<ChevronDown
					size={16}
					className={clsx('ml-auto text-muted flex-shrink-0 transition-transform', open && 'rotate-180')}
				/>
			</button>
			{open && (
				<div className="px-3 pb-2.5 pt-1.5 border-t border-border">
					{children}
				</div>
			)}
		</div>
	);
}
