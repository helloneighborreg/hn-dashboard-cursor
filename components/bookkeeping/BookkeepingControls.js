import { useEffect, useState } from 'react';
import { format, subMonths } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import DateInput from '../DateInput';
import { fmt$ } from '../financials/format';
import { ISO_DATE_FMT, todayIso, formatDateOrDash } from '../../lib/dates';

export const DATE_PRESETS = [
	{
		label: 'Last 3 months',
		from: () => format(subMonths(new Date(), 3), ISO_DATE_FMT),
		to: todayIso,
	},
	{
		label: 'Last 6 months',
		from: () => format(subMonths(new Date(), 6), ISO_DATE_FMT),
		to: todayIso,
	},
	{
		label: 'This year',
		from: () => `${new Date().getFullYear()}-01-01`,
		to: todayIso,
		year: true,
	},
	{
		label: 'All time',
		all: true,
	},
];

export function ToggleSwitch({ label, checked, onChange }) {
	return (
		<label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs text-muted">
			<span className="relative inline-flex h-5 w-9 flex-shrink-0">
				<input
					type="checkbox"
					className="sr-only peer"
					checked={checked}
					onChange={(e) => onChange(e.target.checked)}
				/>
				<span className="absolute inset-0 rounded-full bg-gray-200 peer-checked:bg-brand-500 transition-colors" />
				<span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
			</span>
			{label}
		</label>
	);
}

export function DateRangeFilterContent({ dateFrom, dateTo, onApply, close }) {
	const [from, setFrom] = useState(dateFrom);
	const [to, setTo] = useState(dateTo);

	useEffect(() => {
		setFrom(dateFrom);
		setTo(dateTo);
	}, [dateFrom, dateTo]);

	function applyPreset(preset) {
		if (preset.all) {
			onApply({ date_from: '', date_to: '' });
		} else {
			onApply({
				date_from: preset.from(),
				date_to: preset.to(),
			});
		}
		close();
	}

	function applyCustom() {
		onApply({ date_from: from, date_to: to });
		close();
	}

	return (
		<div className="space-y-2 min-w-[14rem]">
			{DATE_PRESETS.map((preset) => (
				<button
					key={preset.label}
					type="button"
					className="block w-full text-left text-xs px-2 py-1.5 rounded hover:bg-gray-50"
					onClick={() => applyPreset(preset)}
				>
					{preset.label}
				</button>
			))}
			<div className="border-t border-border pt-2 mt-1">
				<p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
					Custom range
				</p>
				<div className="px-2 space-y-2">
					<label className="block">
						<span className="text-[10px] text-muted">From</span>
						<DateInput
							className="input-compact w-full mt-0.5"
							value={from}
							onChange={(e) => setFrom(e.target.value)}
						/>
					</label>
					<label className="block">
						<span className="text-[10px] text-muted">To</span>
						<DateInput
							className="input-compact w-full mt-0.5"
							value={to}
							onChange={(e) => setTo(e.target.value)}
						/>
					</label>
					<button
						type="button"
						onClick={applyCustom}
						className="btn-primary w-full text-xs justify-center py-1.5"
					>
						Apply
					</button>
				</div>
			</div>
		</div>
	);
}

export function formatDateFilterLabel(dateFrom, dateTo) {
	if (!dateFrom && !dateTo) return 'All time';
	if (dateFrom && dateTo) return `${formatDateOrDash(dateFrom)} – ${formatDateOrDash(dateTo)}`;
	if (dateFrom) return `From ${formatDateOrDash(dateFrom)}`;
	return `Through ${formatDateOrDash(dateTo)}`;
}

export function FilterPill({ label, children }) {
	const [open, setOpen] = useState(false);
	return (
		<div className="relative">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-white text-xs font-medium text-dark hover:border-brand-400"
			>
				{label}
				<ChevronDown size={12} className="text-muted" />
			</button>
			{open && (
				<>
					<button
						type="button"
						className="fixed inset-0 z-20"
						aria-label="Close menu"
						onClick={() => setOpen(false)}
					/>
					<div className="absolute left-0 top-full z-30 mt-1 min-w-[10rem] rounded-lg border border-border bg-white shadow-lg p-2">
						{typeof children === 'function' ? children(() => setOpen(false)) : children}
					</div>
				</>
			)}
		</div>
	);
}

export function InlineSelect({ value, placeholder, options, onChange, className, disabled }) {
	return (
		<select
			disabled={disabled}
			className={clsx(
				'select-compact max-w-[11rem] truncate',
				!value && 'text-brand-600 font-medium',
				className,
			)}
			value={value || ''}
			onChange={(e) => onChange(e.target.value)}
		>
			<option value="">{placeholder}</option>
			{options.map((opt) => (
				<option key={opt.value} value={opt.value}>{opt.label}</option>
			))}
		</select>
	);
}

export function CategorizationProgress({ summary }) {
	const pct = summary?.categorized_pct ?? 0;
	const uncCount = summary?.uncategorized_count ?? 0;
	const uncTotal = summary?.uncategorized_total ?? 0;
	const ring = 2 * Math.PI * 36;
	const offset = ring - (pct / 100) * ring;

	return (
		<div className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
			<div className="flex items-center gap-4">
				<div className="relative w-20 h-20 flex-shrink-0">
					<svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
						<circle cx="40" cy="40" r="36" fill="none" stroke="#E5E7EB" strokeWidth="8" />
						<circle
							cx="40"
							cy="40"
							r="36"
							fill="none"
							stroke="#5B9AB8"
							strokeWidth="8"
							strokeDasharray={ring}
							strokeDashoffset={offset}
							strokeLinecap="round"
						/>
					</svg>
					<span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-dark">
						{pct}%
					</span>
				</div>
				<div>
					<p className="text-sm font-semibold text-dark">
						{pct >= 90 ? 'Nearly done' : pct >= 50 ? 'In progress' : 'Get started'}
					</p>
					<p className="text-xs text-muted mt-0.5">of transactions categorized & reviewed</p>
				</div>
			</div>
			{uncCount > 0 && (
				<div className="sm:ml-auto text-sm">
					<span className="font-semibold text-dark uppercase tracking-wide text-xs">Uncategorized</span>
					<p className="text-muted mt-0.5">
						<span className="font-medium text-dark">{uncCount.toLocaleString()}</span>
						{' '}transactions →{' '}
						<span className="font-medium text-dark">{fmt$(uncTotal)}</span>
					</p>
				</div>
			)}
		</div>
	);
}
