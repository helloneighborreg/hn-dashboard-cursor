import { canViewReservationData } from './roles';
import { propertyLabelForTask } from './taskDisplay';

const REDACTED_FIELDS = [
	'guest_name',
	'reservation_id',
	'hospitable_reservation_id',
	'description',
];

/** Strip reservation and guest fields from tasks returned to non-admins. */
export function sanitizeTaskForViewer(task, user, navPermissions) {
	if (!task || canViewReservationData(user, navPermissions)) return task;

	const propertyName = propertyLabelForTask(task);
	const sanitized = { ...task };
	for (const field of REDACTED_FIELDS) {
		sanitized[field] = null;
	}
	if (propertyName) {
		sanitized.title = propertyName;
	}
	return sanitized;
}

export function sanitizeTasksForViewer(tasks, user, navPermissions) {
	if (!tasks?.length || canViewReservationData(user, navPermissions)) return tasks || [];
	return tasks.map((task) => sanitizeTaskForViewer(task, user, navPermissions));
}
