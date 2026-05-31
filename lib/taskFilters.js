import { format, startOfMonth, endOfMonth } from 'date-fns';

const FILTER_KEYS = ['property_id', 'assignee', 'status', 'date_from', 'date_to'];

export const EMPTY_TASK_FILTERS = {
	property_id: '',
	assignee: '',
	status: '',
	date_from: '',
	date_to: '',
	today: false,
};

/** ISO date bounds for a yyyy-MM calendar month key. */
export function calendarMonthDateRange(monthKey) {
	const [year, month] = monthKey.split('-').map(Number);
	if (!year || !month) return null;
	const monthDate = new Date(year, month - 1, 1);
	return {
		date_from: format(startOfMonth(monthDate), 'yyyy-MM-dd'),
		date_to: format(endOfMonth(monthDate), 'yyyy-MM-dd'),
	};
}

export function taskFiltersFromQuery(query = {}) {
	return {
		property_id: typeof query.property_id === 'string' ? query.property_id : '',
		assignee: typeof query.assignee === 'string' ? query.assignee : '',
		status: typeof query.status === 'string' ? query.status : '',
		date_from: typeof query.date_from === 'string' ? query.date_from : '',
		date_to: typeof query.date_to === 'string' ? query.date_to : '',
		today: query.today === 'true',
	};
}

export function taskFiltersToQuery(filters, existingQuery = {}) {
	const query = { ...existingQuery };
	delete query.tab;

	for (const key of FILTER_KEYS) {
		if (filters[key]) query[key] = filters[key];
		else delete query[key];
	}

	if (filters.today) query.today = 'true';
	else delete query.today;

	return query;
}
