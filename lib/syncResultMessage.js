import { formatChangeLine, getBookingChanges } from './taskSchedule';

/** Human-readable alert after POST /api/tasks/sync */
export function formatSyncResultAlert(result = {}) {
	const created = result.created ?? 0;
	const updated = result.updated ?? 0;
	const deleted = result.deleted ?? 0;
	const skipped = result.skipped ?? 0;
	const bookingUpdates = result.booking_updates ?? [];

	const lines = [
		'Sync complete.',
		`${created} created, ${updated} updated, ${deleted} removed (cancelled).`,
	];

	if (bookingUpdates.length) {
		lines.push('', 'Booking changes applied:');
		for (const row of bookingUpdates.slice(0, 8)) {
			const code = row.code || row.title || 'Task';
			const detail = (row.changes || []).join('; ') || 'schedule updated';
			lines.push(`• ${code}: ${detail}`);
		}
		if (bookingUpdates.length > 8) {
			lines.push(`• …and ${bookingUpdates.length - 8} more`);
		}
	} else if (updated === 0 && created === 0 && deleted === 0) {
		lines.push('', 'No task rows changed (already up to date with Hospitable).');
	}

	return lines.join('\n');
}

export function bookingUpdateSummary(previousTask, task) {
	const changes = getBookingChanges(previousTask, task).map(formatChangeLine);
	if (!changes.length) return null;

	const code = task?.reservation_id?.trim() || '';
	return {
		code,
		title: task?.title || code,
		changes,
	};
}

/** True when sync wrote different task fields than before. */
export function taskSyncRowChanged(before, after) {
	if (!before || !after) return false;
	const keys = [
		'reservation_id',
		'hospitable_reservation_id',
		'property_id',
		'property_name',
		'guest_name',
		'has_pets',
		'pet_count',
		'checkin_date',
		'checkin_time',
		'checkout_date',
		'due_date',
		'due_time',
		'start_time',
		'title',
		'description',
	];
	return keys.some((k) => String(before[k] ?? '') !== String(after[k] ?? ''));
}
