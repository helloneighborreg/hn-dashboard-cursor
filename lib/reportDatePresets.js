import { format, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ISO_DATE_FMT, todayIso } from './dates';

export const DATE_RANGE_PRESETS = [
	{
		id: 'last_month',
		label: 'Last month',
		range: () => {
			const end = endOfMonth(subMonths(new Date(), 1));
			const start = startOfMonth(end);
			return {
				date_from: format(start, ISO_DATE_FMT),
				date_to: format(end, ISO_DATE_FMT),
			};
		},
	},
	{
		id: 'last_12_months',
		label: 'Last 12 months',
		range: () => {
			const end = new Date();
			const start = startOfMonth(subMonths(end, 11));
			return {
				date_from: format(start, ISO_DATE_FMT),
				date_to: todayIso(),
			};
		},
	},
	{
		id: 'last_calendar_year',
		label: 'Last calendar year',
		range: () => {
			const year = new Date().getFullYear() - 1;
			return {
				date_from: `${year}-01-01`,
				date_to: `${year}-12-31`,
			};
		},
	},
	{
		id: 'this_year',
		label: 'This year',
		range: () => ({
			date_from: `${new Date().getFullYear()}-01-01`,
			date_to: todayIso(),
		}),
	},
	{
		id: 'custom',
		label: 'Custom range',
		range: null,
	},
];

export function presetById(id) {
	return DATE_RANGE_PRESETS.find((p) => p.id === id) || DATE_RANGE_PRESETS.find((p) => p.id === 'custom');
}

export function formatReportSubtitle(dateFrom, dateTo) {
	if (!dateFrom && !dateTo) return '';
	const from = dateFrom ? format(parseISO(dateFrom), 'MMM d, yyyy') : '…';
	const to = dateTo ? format(parseISO(dateTo), 'MMM d, yyyy') : '…';
	return `From ${from} through ${to}`;
}
