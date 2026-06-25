import { format } from 'date-fns';

import { getReservationCode } from './codes';
import { formatDateOrDash } from './dates';

const DEFAULT_START = '10:00';
const PLACEHOLDER_PROPERTY = 'Property';

export function effectiveStartTime(task) {
	return task?.start_time || DEFAULT_START;
}

export function formatClock(timeStr) {
	const value = timeStr || DEFAULT_START;
	const [h, m] = value.split(':').map(Number);
	if (Number.isNaN(h)) return value;
	const d = new Date();
	d.setHours(h, m || 0, 0, 0);
	return format(d, 'h:mm a');
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function reservationCode(item) {
	const fromCode = getReservationCode(item);
	if (fromCode) return fromCode;

	const fromId = String(item?.reservation_id || '').trim();
	if (fromId && !UUID_RE.test(fromId)) return fromId;

	if (item?.title?.includes(' - ')) {
		const head = item.title.split(' - ', 2)[0]?.trim();
		if (head && !UUID_RE.test(head)) return head;
	}

	return '';
}

function propertyFromTitle(title) {
	if (!title?.includes(' - ')) return '';
	const prop = title.split(' - ').slice(1).join(' - ').trim();
	if (!prop || prop === PLACEHOLDER_PROPERTY) return '';
	return prop;
}

function propertyLabel(item) {
	const fromField = item?.property_name?.trim() || '';
	if (fromField && fromField !== PLACEHOLDER_PROPERTY) return fromField;
	return propertyFromTitle(item?.title);
}

/** Property name/code for display and sanitization. */
export function propertyLabelForTask(item) {
	return propertyLabel(item);
}

/** Primary label: RESERVATION# - PROPERTY (e.g. HM9CABAAY9 - CJC8303). */
export function reservationHeadline(item) {
	const res = reservationCode(item);
	const prop = propertyLabel(item);

	if (res && prop) return `${res} - ${prop}`;
	if (res) return res;
	if (prop) return prop;

	const title = item?.title?.trim();
	if (title && !UUID_RE.test(title) && !title.endsWith(` - ${PLACEHOLDER_PROPERTY}`)) {
		return title;
	}

	return '—';
}

/** Task list headline — same RESERVATION# - PROPERTY format for admins; property only otherwise. */
export function taskHeadline(task, options = {}) {
	const showReservation = options.showReservationDetails !== false;
	if (!showReservation) {
		const prop = propertyLabel(task);
		return prop || '—';
	}

	const headline = reservationHeadline(task);
	if (headline !== '—') return headline;

	const res = reservationCode(task);
	if (res) return res;
	return 'Sync to load reservation';
}

/** Subtitle under task name — guest name (admins only). */
export function taskGuestSubtitle(task, options = {}) {
	if (options.showReservationDetails === false) return '';
	return task.guest_name?.trim() || '—';
}

export function formatDateShort(dateStr) {
	return formatDateOrDash(dateStr);
}
