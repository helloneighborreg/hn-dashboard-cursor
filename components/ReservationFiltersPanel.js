import { Filter } from 'lucide-react';
import DateInput from './DateInput';
import FilterPanel, { FilterField } from './FilterPanel';
import { getPropertyDisplayName } from '../lib/codes';

const STATUSES = ['accepted', 'cancelled', 'expired'];

function countActiveFilters(filters) {
	let n = 0;
	if (filters.property) n += 1;
	if (filters.status) n += 1;
	if (filters.platform) n += 1;
	if (filters.start) n += 1;
	if (filters.end) n += 1;
	return n;
}

function filterSummary(filters, properties) {
	const parts = [];
	if (filters.property) {
		const prop = properties.find((p) => p.id === filters.property);
		parts.push(getPropertyDisplayName(prop) || 'Property');
	}
	if (filters.status) parts.push(filters.status);
	if (filters.platform) parts.push(filters.platform.replace('_', ' '));
	if (filters.start || filters.end) {
		parts.push(`${filters.start || '…'} – ${filters.end || '…'}`);
	}
	return parts.join(' · ') || 'All reservations';
}

export default function ReservationFiltersPanel({ filters, setFilters, properties, onApply }) {
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
						onChange={(e) => setFilters((f) => ({ ...f, property: e.target.value }))}
					>
						<option value="">All properties</option>
						{properties.map((p) => <option key={p.id} value={p.id}>{getPropertyDisplayName(p) || p.name}</option>)}
					</select>
				</FilterField>
				<FilterField label="Status" className="w-28 sm:w-32">
					<select
						className="select-compact"
						value={filters.status}
						onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
					>
						<option value="">All statuses</option>
						{STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
					</select>
				</FilterField>
				<FilterField label="Platform" className="w-28 sm:w-32">
					<select
						className="select-compact"
						value={filters.platform}
						onChange={(e) => setFilters((f) => ({ ...f, platform: e.target.value }))}
					>
						<option value="">All platforms</option>
						<option value="airbnb">Airbnb</option>
						<option value="homeaway">VRBO</option>
						<option value="booking_com">Booking.com</option>
						<option value="direct">Direct</option>
					</select>
				</FilterField>
				<FilterField label="Check-in from" className="w-28 sm:w-32">
					<DateInput
						className="input-compact w-full"
						value={filters.start}
						onChange={(e) => setFilters((f) => ({ ...f, start: e.target.value }))}
					/>
				</FilterField>
				<FilterField label="Check-in to" className="w-28 sm:w-32">
					<DateInput
						className="input-compact w-full"
						value={filters.end}
						onChange={(e) => setFilters((f) => ({ ...f, end: e.target.value }))}
					/>
				</FilterField>
				<button type="button" onClick={onApply} className="btn-primary text-xs gap-1.5 justify-center py-1.5">
					<Filter size={14} /> Apply
				</button>
			</div>
		</FilterPanel>
	);
}
