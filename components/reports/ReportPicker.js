import { useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, Star } from 'lucide-react';
import { REPORT_TYPES } from '../../lib/reportDefinitions';

function FavoriteStar({ active, onToggle, label }) {
	return (
		<button
			type="button"
			onClick={(e) => {
				e.stopPropagation();
				onToggle();
			}}
			className={clsx(
				'p-1 rounded-md flex-shrink-0 transition-colors',
				active
					? 'text-amber-500 hover:text-amber-600'
					: 'text-gray-300 hover:text-amber-400',
			)}
			aria-label={active ? `Remove ${label} from favorites` : `Add ${label} to favorites`}
			aria-pressed={active}
		>
			<Star size={16} className={clsx(active && 'fill-current')} />
		</button>
	);
}

export default function ReportPicker({
	reportId,
	favorites,
	onSelect,
	onToggleFavorite,
}) {
	const [open, setOpen] = useState(false);
	const activeReport = reportId ? REPORT_TYPES.find((r) => r.id === reportId) : null;
	const favoriteSet = new Set(favorites);

	function pick(id) {
		onSelect(id);
		setOpen(false);
	}

	return (
		<div className="relative w-full sm:max-w-xs lg:max-w-sm">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="select-compact w-full flex items-center gap-2 text-left"
				aria-expanded={open}
				aria-haspopup="listbox"
			>
				<span className={clsx('truncate flex-1', activeReport ? 'font-medium text-dark' : 'text-muted')}>
					{activeReport?.label || 'Select a report…'}
				</span>
				<ChevronDown size={14} className={clsx('text-muted flex-shrink-0 transition-transform', open && 'rotate-180')} />
			</button>

			{open && (
				<>
					<button
						type="button"
						className="fixed inset-0 z-20"
						aria-label="Close report menu"
						onClick={() => setOpen(false)}
					/>
					<ul
						className="absolute left-0 top-full z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-border bg-white shadow-lg p-1.5"
						role="listbox"
						aria-label="Reports"
					>
						{REPORT_TYPES.map((report) => {
							const selected = report.id === reportId;
							const favorited = favoriteSet.has(report.id);
							return (
								<li key={report.id} role="option" aria-selected={selected}>
									<button
										type="button"
										onClick={() => pick(report.id)}
										className={clsx(
											'w-full text-left rounded-lg px-2 py-2 flex items-start gap-2 transition-colors',
											selected ? 'bg-brand-50 text-brand-700' : 'hover:bg-gray-50 text-dark',
										)}
									>
										<div className="min-w-0 flex-1">
											<p className="text-sm font-medium">{report.label}</p>
											{report.description ? (
												<p className="text-xs text-muted mt-0.5 line-clamp-2">{report.description}</p>
											) : null}
										</div>
										<FavoriteStar
											active={favorited}
											label={report.label}
											onToggle={() => onToggleFavorite(report.id)}
										/>
									</button>
								</li>
							);
						})}
					</ul>
				</>
			)}
		</div>
	);
}
