import { formatClock, formatDateShort } from './taskDisplay';

export function formatCheckoutSchedule(task) {
	const date = formatDateShort(task?.checkout_date || task?.due_date);
	const time = formatClock(task?.start_time || '10:00');
	return `${date} at ${time}`;
}

export function formatDueSchedule(task) {
	const date = formatDateShort(task?.due_date);
	const time = formatClock(task?.due_time || '16:00');
	return `${date} at ${time}`;
}

/** True when checkout or due date/time changed. */
export function taskScheduleChanged(before, after) {
	if (!before || !after) return false;
	return (
		formatCheckoutSchedule(before) !== formatCheckoutSchedule(after)
		|| formatDueSchedule(before) !== formatDueSchedule(after)
	);
}

export function scheduleChangeLines(before, after) {
	const lines = [];
	const checkoutBefore = formatCheckoutSchedule(before);
	const checkoutAfter = formatCheckoutSchedule(after);
	if (checkoutBefore !== checkoutAfter) {
		lines.push(`Checkout: ${checkoutBefore} → ${checkoutAfter}`);
	}
	const dueBefore = formatDueSchedule(before);
	const dueAfter = formatDueSchedule(after);
	if (dueBefore !== dueAfter) {
		lines.push(`Due: ${dueBefore} → ${dueAfter}`);
	}
	return lines;
}
