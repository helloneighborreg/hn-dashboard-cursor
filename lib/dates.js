import { format, parseISO } from 'date-fns';

export const DISPLAY_DATE_FMT = 'MM-dd-yy';
export const ISO_DATE_FMT = 'yyyy-MM-dd';

// The business operates in Central Time. Anchor "today" to this zone so the date is
// correct regardless of runtime timezone (Cloudflare Workers run in UTC, which would
// roll over to the next day in the evening Central time).
export const BUSINESS_TIMEZONE =
	(typeof process !== 'undefined' && process.env?.BUSINESS_TIMEZONE) || 'America/Chicago';

export function todayIso(timeZone = BUSINESS_TIMEZONE) {
	// en-CA formats as YYYY-MM-DD; the timeZone option shifts the wall-clock date.
	return new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(new Date());
}

export function startOfYearIso(date = new Date()) {
	return format(new Date(date.getFullYear(), 0, 1), ISO_DATE_FMT);
}

export function toIsoDate(value) {
	const d = toDate(value);
	return d ? format(d, ISO_DATE_FMT) : '';
}

export function parseToIsoDate(value) {
	if (!value?.trim()) return '';
	// Accept -, /, or \ as separators (normalize to - before parsing).
	const s = value.trim().replace(/[/\\]/g, '-');

	if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
		const [yyyy, mm, dd] = s.split('-');
		return isoFromParts(mm, dd, yyyy);
	}

	const match4 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
	if (match4) {
		const [, mm, dd, yyyy] = match4;
		return isoFromParts(mm, dd, yyyy);
	}

	const match2 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2})$/);
	if (match2) {
		const [, mm, dd, yy] = match2;
		const year = expandTwoDigitYear(yy);
		if (year == null) return null;
		return isoFromParts(mm, dd, String(year));
	}

	return null;
}

function expandTwoDigitYear(yy) {
	const n = parseInt(yy, 10);
	if (Number.isNaN(n)) return null;
	return n <= 68 ? 2000 + n : 1900 + n;
}

function isoFromParts(mm, dd, yyyy) {
	const iso = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
	const d = parseISO(iso);
	if (Number.isNaN(d.getTime()) || format(d, ISO_DATE_FMT) !== iso) return null;
	return iso;
}

function toDate(value) {
	if (!value) return null;
	if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

	const s = String(value).trim();
	if (!s) return null;

	const iso = /^\d{4}[-/\\]\d{1,2}[-/\\]\d{1,2}/.test(s)
		? s.replace(/[/\\]/g, '-').slice(0, 10)
		: parseToIsoDate(s);
	if (!iso) return null;

	const d = parseISO(`${iso}T12:00:00`);
	return Number.isNaN(d.getTime()) ? null : d;
}

/** Extract HH:mm wall-clock time from an ISO datetime (property local time, not server TZ). */
export function parseIsoWallClockTime(value) {
	const s = String(value || '').trim();
	if (!s.includes('T')) return null;
	const match = s.match(/T(\d{2}):(\d{2})(?::\d{2})?/);
	if (!match) return null;
	return `${match[1]}:${match[2]}`;
}

export function formatDate(value) {
	const d = toDate(value);
	return d ? format(d, DISPLAY_DATE_FMT) : '';
}

export function formatDateOrDash(value) {
	return formatDate(value) || '—';
}

export function formatDateRange(start, end, separator = ' – ') {
	const a = formatDate(start);
	const b = formatDate(end);
	if (!a && !b) return '—';
	if (!a) return b;
	if (!b) return a;
	return `${a}${separator}${b}`;
}

/** Format YYYY-MM month keys for chart axes (MM-YY). */
export function formatMonthKey(isoMonth) {
	if (!isoMonth?.includes('-')) return isoMonth || '';
	const [year, month] = isoMonth.split('-');
	if (!year || !month) return isoMonth;
	return `${month}-${year.slice(-2)}`;
}

export function formatDateTime(value) {
	if (!value) return '—';
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return '—';
	return `${format(d, DISPLAY_DATE_FMT)} ${format(d, 'h:mm a')}`;
}
