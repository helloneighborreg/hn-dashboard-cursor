import { format } from 'date-fns';
import { Filter } from 'lucide-react';
import DateInput from '../DateInput';
import FilterPanel, { FilterField } from '../FilterPanel';
import { ISO_DATE_FMT, todayIso } from '../../lib/dates';
import { getPropertyDisplayName } from '../../lib/codes';

const PRESETS = [
	{
		label: 'This month',
		from: () => format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), ISO_DATE_FMT),
		to: todayIso,
	},
	{
		label: 'Last month',
		from: () => format(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1), ISO_DATE_FMT),
		to: () => format(new Date(new Date().getFullYear(), new Date().getMonth(), 0), ISO_DATE_FMT),
	},
	{
		label: 'This year',
		from: () => `${new Date().getFullYear()}-01-01`,
		to: todayIso,
	},
	{
		label: 'Last 90 days',
		from: () => format(new Date(Date.now() - 90 * 86400000), ISO_DATE_FMT),
		to: todayIso,
	},
];

function countActiveFilters(filters) {
	return filters.property ? 1 : 0;
}

function filterSummary(filters, properties) {
	const parts = [];
	if (filters.property) {
		const prop = properties.find((p) => p.id === filters.property);
		parts.push(getPropertyDisplayName(prop) || 'Property');
	}
	if (filters.date_from || filters.date_to) {
		parts.push(`${filters.date_from || '…'} – ${filters.date_to || '…'}`);
	}
	return parts.join(' · ') || 'All properties';
}

export default function FinancialsFilters({ filters, properties, onChange, onApply }) {
	const activeCount = countActiveFilters(filters);

	return (
		<FilterPanel
			activeCount={activeCount}
			summary={filterSummary(filters, properties)}
		>
			<div className="flex flex-wrap items-end gap-2">
				<FilterField label="Property" className="w-36 sm:w-40">
					<select
						className="select-compact"
						value={filters.property}
						onChange={(e) => onChange({ ...filters, property: e.target.value })}
					>
						<option value="">All properties</option>
						{properties.map((p) => (
							<option key={p.id} value={p.id}>{getPropertyDisplayName(p) || p.name}</option>
						))}
					</select>
				</FilterField>
				<FilterField label="Date from" className="w-28 sm:w-32">
					<DateInput
						className="input-compact w-full"
						value={filters.date_from}
						onChange={(e) => onChange({ ...filters, date_from: e.target.value })}
					/>
				</FilterField>
				<FilterField label="Date to" className="w-28 sm:w-32">
					<DateInput
						className="input-compact w-full"
						value={filters.date_to}
						onChange={(e) => onChange({ ...filters, date_to: e.target.value })}
					/>
				</FilterField>
				<button type="button" onClick={() => onApply()} className="btn-primary text-xs gap-1.5 justify-center py-1.5">
					<Filter size={14} /> Apply
				</button>
			</div>

			<div className="flex flex-wrap gap-1.5 mt-2">
				{PRESETS.map(({ label, from, to }) => (
					<button
						key={label}
						type="button"
						onClick={() => onApply({ date_from: from(), date_to: to() })}
						className="text-xs px-2.5 py-1 rounded-full border border-border hover:border-brand-400 hover:text-brand-600 transition-colors"
					>
						{label}
					</button>
				))}
			</div>
		</FilterPanel>
	);
}
