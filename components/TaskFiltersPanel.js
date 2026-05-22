import { Filter } from 'lucide-react';
import { ASSIGNEES } from '../lib/constants';

export default function TaskFiltersPanel({
	filters,
	setFilters,
	properties,
	isUnassigned,
	onApply,
	showAssigneeFilter = true,
}) {
	return (
		<div className="card p-4 mb-5">
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
				<div>
					<label className="label">Property</label>
					<select
						className="select w-full"
						value={filters.property_id}
						onChange={(e) => setFilters((f) => ({ ...f, property_id: e.target.value }))}
					>
						<option value="">All properties</option>
						{properties.map((p) => (
							<option key={p.id} value={p.id}>{p.name}</option>
						))}
					</select>
				</div>
				{!isUnassigned && (
					<div>
						<label className="label">Status</label>
						<select
							className="select w-full"
							value={filters.status}
							onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
						>
							<option value="">All statuses</option>
							<option value="assigned">Assigned</option>
							<option value="completed">Completed</option>
						</select>
					</div>
				)}
				{showAssigneeFilter && (
					<div>
						<label className="label">Assignee</label>
						<select
							className="select w-full"
							value={filters.assignee}
							onChange={(e) => setFilters((f) => ({ ...f, assignee: e.target.value }))}
						>
							<option value="">All assignees</option>
							{ASSIGNEES.map((a) => <option key={a} value={a}>{a}</option>)}
						</select>
					</div>
				)}
				<div>
					<label className="label">Due from</label>
					<input
						type="date"
						className="input w-full"
						value={filters.date_from}
						onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
					/>
				</div>
				<div>
					<label className="label">Due to</label>
					<input
						type="date"
						className="input w-full"
						value={filters.date_to}
						onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
					/>
				</div>
				<div className="flex items-end">
					<label className="flex items-center gap-2 cursor-pointer py-2">
						<input
							type="checkbox"
							checked={filters.today}
							onChange={(e) => setFilters((f) => ({ ...f, today: e.target.checked }))}
							className="rounded text-brand-500"
						/>
						<span className="text-sm">Today only</span>
					</label>
				</div>
				<div className="sm:col-span-2 lg:col-span-1 flex items-end">
					<button type="button" onClick={onApply} className="btn-primary w-full justify-center gap-1.5">
						<Filter size={14} /> Apply filters
					</button>
				</div>
			</div>
		</div>
	);
}
