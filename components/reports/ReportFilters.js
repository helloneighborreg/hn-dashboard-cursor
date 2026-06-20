import { useMemo } from 'react';
import { format } from 'date-fns';
import { Filter } from 'lucide-react';
import clsx from 'clsx';
import DateInput from '../DateInput';
import FilterPanel, { FilterField } from '../FilterPanel';
import { ISO_DATE_FMT, todayIso } from '../../lib/dates';
import {
	buildPropertyGroups,
	propertyFilterSummary,
} from '../../lib/propertyGroups';
import { DATE_RANGE_PRESETS } from '../../lib/reportDatePresets';

const INCOME_STATEMENT_REPORTS = new Set(['noi', 'net-cash-flow', 'inflow-outflow']);

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

const MODES = [
	{ value: 'all', label: 'All' },
	{ value: 'one', label: 'One property' },
	{ value: 'group', label: 'Group' },
	{ value: 'custom', label: 'Custom' },
];

function countActiveFilters(filters, showAdvanced) {
	let n = 0;
	if (filters.property_mode && filters.property_mode !== 'all') n += 1;
	if (showAdvanced) {
		if (filters.date_preset && filters.date_preset !== 'custom') n += 1;
		if (filters.interval && filters.interval !== 'month') n += 1;
		if (filters.category_level && filters.category_level !== 'subcategory') n += 1;
	}
	return n;
}

function filterSummary(filters, properties, showAdvanced) {
	const parts = [propertyFilterSummary(properties, filters)];
	if (showAdvanced) {
		const preset = DATE_RANGE_PRESETS.find((p) => p.id === filters.date_preset);
		if (preset && filters.date_preset !== 'custom') parts.push(preset.label);
		else if (filters.date_from || filters.date_to) {
			parts.push(`${filters.date_from || '…'} – ${filters.date_to || '…'}`);
		}
		if (filters.interval === 'quarter') parts.push('By quarter');
	} else if (filters.date_from || filters.date_to) {
		parts.push(`${filters.date_from || '…'} – ${filters.date_to || '…'}`);
	}
	return parts.join(' · ');
}

function modeButtonClass(active) {
	return clsx(
		'text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors',
		active
			? 'border-brand-400 bg-brand-50 text-brand-700'
			: 'border-border text-muted hover:border-brand-300 hover:text-brand-600',
	);
}

export default function ReportFilters({ filters, properties, onChange, onApply, reportId }) {
	const groups = useMemo(() => buildPropertyGroups(properties), [properties]);
	const showAdvanced = INCOME_STATEMENT_REPORTS.has(reportId);
	const activeCount = countActiveFilters(filters, showAdvanced);
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

	function setMode(nextMode) {
		onChange({
			...filters,
			property_mode: nextMode,
			property: nextMode === 'one' ? filters.property : '',
			property_group: nextMode === 'group' ? (filters.property_group || groups[0]?.id || '') : '',
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
			summary={filterSummary(filters, properties, showAdvanced)}
		>
			<div className="space-y-3">
				<div>
					<p className="label mb-1.5">Properties</p>
					<div className="flex flex-wrap gap-1.5">
						{MODES.map(({ value, label }) => (
							<button
								key={value}
								type="button"
								onClick={() => setMode(value)}
								className={modeButtonClass(mode === value)}
							>
								{label}
							</button>
						))}
					</div>
				</div>

				{mode === 'one' && (
					<FilterField label="Property" className="w-full sm:w-64">
						<select
							className="select-compact w-full"
							value={filters.property || ''}
							onChange={(e) => onChange({ ...filters, property: e.target.value })}
						>
							<option value="">Select property…</option>
							{properties.map((p) => (
								<option key={p.id} value={p.id}>{p.name || p.public_name}</option>
							))}
						</select>
					</FilterField>
				)}

				{mode === 'group' && (
					<FilterField label="Property group" className="w-full sm:w-64">
						<select
							className="select-compact w-full"
							value={filters.property_group || groups[0]?.id || ''}
							onChange={(e) => onChange({ ...filters, property_group: e.target.value })}
						>
							{groups.map((g) => (
								<option key={g.id} value={g.id}>
									{g.label} ({g.propertyIds.length})
								</option>
							))}
						</select>
					</FilterField>
				)}

				{mode === 'custom' && (
					<div>
						<div className="flex items-center justify-between gap-2 mb-2">
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
						<div className="max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border">
							{groupedProperties.map((bucket) => (
								<div key={bucket.id} className="p-2">
									<p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1.5 px-1">
										{bucket.label}
									</p>
									<div className="space-y-1">
										{bucket.properties.map((p) => {
											const checked = (filters.property_ids || []).includes(p.id);
											return (
												<label
													key={p.id}
													className="flex items-center gap-2 px-1 py-1 rounded hover:bg-gray-50 cursor-pointer"
												>
													<input
														type="checkbox"
														checked={checked}
														onChange={() => toggleCustomProperty(p.id)}
														className="rounded text-brand-500"
													/>
													<span className="text-sm text-dark truncate">
														{p.name || p.public_name}
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

				{showAdvanced && (
					<div className="flex flex-wrap items-end gap-2">
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
						<FilterField label="Reporting interval" className="w-32 sm:w-36">
							<select
								className="select-compact w-full"
								value={filters.interval || 'month'}
								onChange={(e) => onChange({ ...filters, interval: e.target.value })}
							>
								<option value="month">By month</option>
								<option value="quarter">By quarter</option>
							</select>
						</FilterField>
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
					</div>
				)}

				<div className="flex flex-wrap items-end gap-2 pt-1">
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

				{!showAdvanced && (
					<div className="flex flex-wrap gap-1.5">
						{PRESETS.map(({ label, from, to }) => (
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
				)}
			</div>
		</FilterPanel>
	);
}
