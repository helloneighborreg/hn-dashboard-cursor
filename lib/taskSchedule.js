import { formatClock, formatDateShort } from './taskDisplay';

export function formatCheckinSchedule(task) {
	const date = formatDateShort(task?.checkin_date);
	const time = formatClock(task?.checkin_time || '16:00');
	if (!task?.checkin_date) return '—';
	return `${date} at ${time}`;
}

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

function guestDisplay(task) {
	return task?.guest_name?.trim() || task?.description?.trim() || '—';
}

function petsDisplay(task) {
	const count = Number(task?.pet_count) || 0;
	if (count > 0) return count === 1 ? '1 pet' : `${count} pets`;
	return task?.has_pets ? 'Pets' : 'No pets';
}

/** Structured before/after entries for notification copy. */
export function getBookingChanges(before, after) {
	if (!before || !after) return [];

	const changes = [];

	if (before?.checkin_date || after?.checkin_date) {
		const checkinBefore = formatCheckinSchedule(before);
		const checkinAfter = formatCheckinSchedule(after);
		if (checkinBefore !== checkinAfter) {
			changes.push({ label: 'Check-in', before: checkinBefore, after: checkinAfter });
		}
	}

	const checkoutBefore = formatCheckoutSchedule(before);
	const checkoutAfter = formatCheckoutSchedule(after);
	if (checkoutBefore !== checkoutAfter) {
		changes.push({ label: 'Checkout', before: checkoutBefore, after: checkoutAfter });
	}

	const dueBefore = formatDueSchedule(before);
	const dueAfter = formatDueSchedule(after);
	if (dueBefore !== dueAfter) {
		changes.push({ label: 'Due', before: dueBefore, after: dueAfter });
	}

	const guestBefore = guestDisplay(before);
	const guestAfter = guestDisplay(after);
	if (guestBefore !== guestAfter) {
		changes.push({ label: 'Guest', before: guestBefore, after: guestAfter });
	}

	const petsBefore = petsDisplay(before);
	const petsAfter = petsDisplay(after);
	if (petsBefore !== petsAfter) {
		changes.push({ label: 'Pets', before: petsBefore, after: petsAfter });
	}

	const propertyBefore = before?.property_name?.trim() || '—';
	const propertyAfter = after?.property_name?.trim() || '—';
	if (propertyBefore !== propertyAfter) {
		changes.push({ label: 'Property', before: propertyBefore, after: propertyAfter });
	}

	return changes;
}

/** True when any reservation-synced booking detail changed. */
export function taskBookingChanged(before, after) {
	return getBookingChanges(before, after).length > 0;
}

/** True when checkout or due date/time changed. */
export function taskScheduleChanged(before, after) {
	if (!before || !after) return false;
	return (
		formatCheckinSchedule(before) !== formatCheckinSchedule(after)
		|| formatCheckoutSchedule(before) !== formatCheckoutSchedule(after)
		|| formatDueSchedule(before) !== formatDueSchedule(after)
	);
}

export function formatChangeLine(change) {
	return `${change.label}: was ${change.before}, now ${change.after}`;
}

export function scheduleChangeLines(before, after) {
	return getBookingChanges(before, after).map(formatChangeLine);
}
