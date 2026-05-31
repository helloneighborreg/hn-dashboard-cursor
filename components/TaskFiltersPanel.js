import { Filter } from 'lucide-react';
import DateInput from './DateInput';
import FilterPanel, { FilterField } from './FilterPanel';
import { ASSIGNEES } from '../lib/constants';

function countActiveFilters(filters, isCalendar) {
	let n = 0;
	if (filters.property_id) n += 1;
	if (filters.status) n += 1;
	if (filters.assignee) n += 1;
	if (!isCalendar) {
		if (filters.date_from) n += 1;
		if (filters.date_to) n += 1;
		if (filters.today) n += 1;
	}
	return n;
}

function filterSummary(filters, properties, isCalendar) {
	const parts = [];
	if (filters.property_id) {
		const prop = properties.find((p) => p.id === filters.property_id);
		parts.push(prop?.name || 'Property');
	}
	if (filters.status) parts.push(filters.status);
	if (filters.assignee) parts.push(filters.assignee);
	if (!isCalendar) {
		if (filters.today) parts.push('Today');
		else if (filters.date_from || filters.date_to) {
			parts.push(`${filters.date_from || '…'} – ${filters.date_to || '…'}`);
		}
	}
	return parts.join(' · ') || 'All tasks';
}

export default function TaskFiltersPanel({
	filters,
	setFilters,
	properties,
	onApply,
	isAdmin = false,
	isCalendar = false,
}) {
	const activeCount = countActiveFilters(filters, isCalendar);

	return (
		<FilterPanel
			activeCount={activeCount}
			summary={filterSummary(filters, properties, isCalendar)}
		>
			{isCalendar && (
				<p className="text-xs text-muted mb-2">
					Calendar view uses the month picker for dates.
				</p>
			)}
			<div className="flex flex-wrap items-end gap-2">
				<FilterField label="Property" className="w-36 sm:w-40">
					<select
						className="select-compact"
						value={filters.property_id}
						onChange={(e) => setFilters((f) => ({ ...f, property_id: e.target.value }))}
					>
						<option value="">All properties</option>
						{properties.map((p) => (
							<option key={p.id} value={p.id}>{p.name}</option>
						))}
					</select>
				</FilterField>
				{isAdmin && (
					<FilterField label="Status" className="w-28 sm:w-32">
						<select
							className="select-compact"
							value={filters.status}
							onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
						>
							<option value="">All statuses</option>
							<option value="unassigned">Unassigned</option>
							<option value="assigned">Assigned</option>
							<option value="completed">Completed</option>
						</select>
					</FilterField>
				)}
				{isAdmin && (
					<FilterField label="Assignee" className="w-28 sm:w-32">
						<select
							className="select-compact"
							value={filters.assignee}
							onChange={(e) => setFilters((f) => ({ ...f, assignee: e.target.value }))}
						>
							<option value="">All assignees</option>
							{ASSIGNEES.map((a) => <option key={a} value={a}>{a}</option>)}
						</select>
					</FilterField>
				)}
				{!isCalendar && (
					<>
						<FilterField label="Due from" className="w-28 sm:w-32">
							<DateInput
								className="input-compact w-full"
								value={filters.date_from}
								onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
							/>
						</FilterField>
						<FilterField label="Due to" className="w-28 sm:w-32">
							<DateInput
								className="input-compact w-full"
								value={filters.date_to}
								onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
							/>
						</FilterField>
						<label className="flex items-center gap-1.5 cursor-pointer py-1.5 px-1">
							<input
								type="checkbox"
								checked={filters.today}
								onChange={(e) => setFilters((f) => ({ ...f, today: e.target.checked }))}
								className="rounded text-brand-500"
							/>
							<span className="text-xs text-dark whitespace-nowrap">Today only</span>
						</label>
					</>
				)}
				<button type="button" onClick={onApply} className="btn-primary text-xs gap-1.5 justify-center py-1.5">
					<Filter size={14} /> Apply
				</button>
			</div>
		</FilterPanel>
	);
}
