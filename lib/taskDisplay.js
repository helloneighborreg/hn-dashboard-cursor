import { format } from 'date-fns';

const DEFAULT_START = '10:00';

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

/** Primary label: RESERVATION# - PROPERTY (e.g. HM9CABAAY9 - CJC8303). */
export function taskHeadline(task) {
	if (task.title?.includes(' - ') && !UUID_RE.test((task.title || '').split(' - ')[0]?.trim())) {
		return task.title;
	}
	const res = task.reservation_id || '';
	const prop = task.property_name || '';
	if (res && prop && !UUID_RE.test(res)) return `${res} - ${prop}`;
	if (task.title && !UUID_RE.test(task.title)) return task.title;
	return 'Sync to load reservation';
}

/** Subtitle under task name — guest name. */
export function taskGuestSubtitle(task) {
	return task.guest_name?.trim() || '—';
}

export function formatDateShort(dateStr) {
	if (!dateStr) return '—';
	return format(new Date(dateStr + 'T12:00:00'), 'MMM d, yyyy');
}
