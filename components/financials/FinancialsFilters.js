import { format } from 'date-fns';
import { Filter } from 'lucide-react';
import DateInput from '../DateInput';
import { ISO_DATE_FMT, todayIso } from '../../lib/dates';

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

export default function FinancialsFilters({ filters, properties, onChange, onApply }) {
	return (
		<div className="card p-4 mb-5">
			<div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
				<div>
					<label className="label">Property</label>
					<select
						className="select"
						value={filters.property}
						onChange={(e) => onChange({ ...filters, property: e.target.value })}
					>
						<option value="">All properties</option>
						{properties.map((p) => (
							<option key={p.id} value={p.id}>{p.name}</option>
						))}
					</select>
				</div>
				<div>
					<label className="label">Date from</label>
					<DateInput
						value={filters.date_from}
						onChange={(e) => onChange({ ...filters, date_from: e.target.value })}
					/>
				</div>
				<div>
					<label className="label">Date to</label>
					<DateInput
						value={filters.date_to}
						onChange={(e) => onChange({ ...filters, date_to: e.target.value })}
					/>
				</div>
				<button type="button" onClick={onApply} className="btn-primary justify-center gap-1.5">
					<Filter size={14} /> Apply
				</button>
			</div>

			<div className="flex flex-wrap gap-2 mt-3">
				{PRESETS.map(({ label, from, to }) => (
					<button
						key={label}
						type="button"
						onClick={() => onApply({ date_from: from(), date_to: to() })}
						className="text-xs px-3 py-1 rounded-full border border-border hover:border-brand-400 hover:text-brand-600 transition-colors"
					>
						{label}
					</button>
				))}
			</div>
		</div>
	);
}
