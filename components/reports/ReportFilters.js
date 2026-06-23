import { useMemo } from 'react';
import { format } from 'date-fns';
import { Filter } from 'lucide-react';
import DateInput from '../DateInput';
import FilterPanel, { FilterField } from '../FilterPanel';
import { ISO_DATE_FMT, todayIso, formatDateOrDash } from '../../lib/dates';
import { getPropertyDisplayName } from '../../lib/codes';
import {
	buildPropertyGroups,
	propertyFilterSummary,
} from '../../lib/propertyGroups';
import { DATE_RANGE_PRESETS } from '../../lib/reportDatePresets';

const INCOME_STATEMENT_REPORTS = new Set(['noi', 'net-cash-flow', 'inflow-outflow']);

const QUICK_DATE_PRESETS = [
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

const PROPERTY_SCOPES = [
	{ value: 'all', label: 'All properties' },
	{ value: 'one', label: 'One property' },
	{ value: 'custom', label: 'Multiple properties' },
];

const STATEMENT_STATUS_OPTIONS = [
	{ value: 'all', label: 'All statuses' },
	{ value: 'complete', label: 'Complete' },
	{ value: 'incomplete', label: 'Incomplete' },
];

function countActiveFilters(filters, showAdvanced, isOwnerStatements) {
	let n = 0;
	if (filters.property_mode && filters.property_mode !== 'all') n += 1;
	if (filters.date_preset && filters.date_preset !== 'this_year') n += 1;
	if (showAdvanced && filters.category_level && filters.category_level !== 'subcategory') n += 1;
	if (isOwnerStatements && filters.statement_status && filters.statement_status !== 'all') n += 1;
	return n;
}

function filterSummary(filters, properties, isOwnerStatements) {
	const parts = [];
	const mode = filters.property_mode || 'all';

	if (mode !== 'all') {
		const propertyPart = propertyFilterSummary(properties, filters);
		if (propertyPart !== 'All properties') parts.push(propertyPart);
	}

	const datePreset = filters.date_preset || 'this_year';
	if (datePreset !== 'this_year') {
		const preset = DATE_RANGE_PRESETS.find((p) => p.id === datePreset);
		if (preset && datePreset !== 'custom') {
			parts.push(preset.label);
		} else if (filters.date_from || filters.date_to) {
			parts.push(`${formatDateOrDash(filters.date_from) || '…'} – ${formatDateOrDash(filters.date_to) || '…'}`);
		}
	}

	if (isOwnerStatements && filters.statement_status === 'complete') parts.push('Complete');
	if (isOwnerStatements && filters.statement_status === 'incomplete') parts.push('Incomplete');
	return parts.join(' · ');
}

export default function ReportFilters({ filters, properties, onChange, onApply, reportId }) {
	const groups = useMemo(() => buildPropertyGroups(properties), [properties]);
	const showAdvanced = INCOME_STATEMENT_REPORTS.has(reportId);
	const isOwnerStatements = reportId === 'owner-statements';
	const activeCount = countActiveFilters(filters, showAdvanced, isOwnerStatements);
	const mode = filters.property_mode || 'all';

	function applyDatePreset(presetId) {
		const preset = DATE_RANGE_PRESETS.find((p) => p.id === presetId);
		if (!preset?.range) {
			onChange({ ...filters, date_preset: 'custom' });
			return;
		}
		const { date_from, date_to } = preset.range();
		onApply({ date_preset: presetId, date_from, date_to });
	}

	function setPropertyScope(nextMode) {
		onChange({
			...filters,
			property_mode: nextMode,
			property: nextMode === 'one' ? filters.property : '',
			property_group: '',
			property_ids: nextMode === 'custom' ? (filters.property_ids || []) : [],
		});
	}

	function toggleCustomProperty(id) {
		const current = new Set(filters.property_ids || []);
		if (current.has(id)) current.delete(id);
		else current.add(id);
		onChange({ ...filters, property_mode: 'custom', property_ids: [...current] });
	}

	const groupedProperties = useMemo(() => {
		const buckets = groups.map((g) => ({
			...g,
			properties: properties.filter((p) => g.propertyIds.includes(p.id)),
		}));
		return buckets.filter((b) => b.properties.length > 0);
	}, [groups, properties]);

	return (
		<FilterPanel
			activeCount={activeCount}
			summary={filterSummary(filters, properties, isOwnerStatements)}
			defaultOpen={false}
		>
			<div className="space-y-2.5">
				<div className="flex flex-wrap items-end gap-2">
					<FilterField label="Properties" className="w-40 sm:w-44">
						<select
							className="select-compact w-full"
							value={mode}
							onChange={(e) => setPropertyScope(e.target.value)}
						>
							{PROPERTY_SCOPES.map(({ value, label }) => (
								<option key={value} value={value}>{label}</option>
							))}
						</select>
					</FilterField>

					{mode === 'one' && (
						<select
							className="select-compact w-40 sm:w-48"
							value={filters.property || ''}
							onChange={(e) => onChange({ ...filters, property: e.target.value })}
							aria-label="Select property"
						>
							<option value="">Choose property…</option>
							{properties.map((p) => (
								<option key={p.id} value={p.id}>{getPropertyDisplayName(p) || p.public_name}</option>
							))}
						</select>
					)}

					<FilterField label="Date range" className="w-36 sm:w-40">
						<select
							className="select-compact w-full"
							value={filters.date_preset || 'custom'}
							onChange={(e) => applyDatePreset(e.target.value)}
						>
							{DATE_RANGE_PRESETS.map((p) => (
								<option key={p.id} value={p.id}>{p.label}</option>
							))}
						</select>
					</FilterField>

					{showAdvanced && (
						<FilterField label="Category" className="w-36 sm:w-40">
							<select
								className="select-compact w-full"
								value={filters.category_level || 'subcategory'}
								onChange={(e) => onChange({ ...filters, category_level: e.target.value })}
							>
								<option value="subcategory">By sub-category</option>
								<option value="category">By category</option>
							</select>
						</FilterField>
					)}

					{isOwnerStatements && (
						<FilterField label="Status" className="w-36 sm:w-40">
							<select
								className="select-compact w-full"
								value={filters.statement_status || 'all'}
								onChange={(e) => onChange({ ...filters, statement_status: e.target.value })}
							>
								{STATEMENT_STATUS_OPTIONS.map(({ value, label }) => (
									<option key={value} value={value}>{label}</option>
								))}
							</select>
						</FilterField>
					)}

					<FilterField label="Date from" className="w-28 sm:w-32">
						<DateInput
							className="input-compact w-full"
							value={filters.date_from}
							onChange={(e) => onChange({ ...filters, date_from: e.target.value, date_preset: 'custom' })}
						/>
					</FilterField>
					<FilterField label="Date to" className="w-28 sm:w-32">
						<DateInput
							className="input-compact w-full"
							value={filters.date_to}
							onChange={(e) => onChange({ ...filters, date_to: e.target.value, date_preset: 'custom' })}
						/>
					</FilterField>
					<button type="button" onClick={() => onApply()} className="btn-primary text-xs gap-1.5 justify-center py-1.5">
						<Filter size={14} /> Apply
					</button>
				</div>

				{mode === 'custom' && (
					<div>
						<div className="flex items-center justify-between gap-2 mb-1.5">
							<p className="text-xs text-muted">
								{(filters.property_ids || []).length} selected
							</p>
							<div className="flex gap-2">
								<button
									type="button"
									className="text-xs text-brand-600 hover:underline"
									onClick={() => onChange({
										...filters,
										property_ids: properties.map((p) => p.id),
									})}
								>
									Select all
								</button>
								<button
									type="button"
									className="text-xs text-muted hover:underline"
									onClick={() => onChange({ ...filters, property_ids: [] })}
								>
									Clear
								</button>
							</div>
						</div>
						<div className="max-h-40 overflow-y-auto border border-border rounded-lg divide-y divide-border">
							{groupedProperties.map((bucket) => (
								<div key={bucket.id} className="p-2">
									<p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1 px-1">
										{bucket.label}
									</p>
									<div className="space-y-0.5">
										{bucket.properties.map((p) => {
											const checked = (filters.property_ids || []).includes(p.id);
											return (
												<label
													key={p.id}
													className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-gray-50 cursor-pointer"
												>
													<input
														type="checkbox"
														checked={checked}
														onChange={() => toggleCustomProperty(p.id)}
														className="rounded text-brand-500"
													/>
													<span className="text-sm text-dark truncate">
														{getPropertyDisplayName(p) || p.public_name}
													</span>
												</label>
											);
										})}
									</div>
								</div>
							))}
						</div>
					</div>
				)}

				<div className="flex flex-wrap gap-1.5">
					{QUICK_DATE_PRESETS.map(({ label, from, to }) => (
						<button
							key={label}
							type="button"
							onClick={() => onApply({ date_from: from(), date_to: to(), date_preset: 'custom' })}
							className="text-xs px-2.5 py-1 rounded-full border border-border hover:border-brand-400 hover:text-brand-600 transition-colors"
						>
							{label}
						</button>
					))}
				</div>
			</div>
		</FilterPanel>
	);
}
