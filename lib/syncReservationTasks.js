import { v4 as uuidv4 } from 'uuid';
import { buildTaskFromReservation, reservationEligibleForTask } from './taskFromReservation';
import { upsertTaskFromReservation } from './db';

/**
 * Create or update local tasks for each reservation (keyed by reservation_id).
 * New tasks are always unassigned; existing tasks keep status/assignee.
 */
export async function syncTasksFromReservations(reservations, propertyMap = {}) {
	let created = 0;
	let updated = 0;
	let skipped = 0;

	for (const reservation of reservations) {
		if (!reservationEligibleForTask(reservation)) {
			skipped++;
			continue;
		}

		const prop = propertyMap[reservation.property_id];
		const fields = buildTaskFromReservation(reservation, prop);
		if (!fields) {
			skipped++;
			continue;
		}

		const { isNew } = await upsertTaskFromReservation({
			id: uuidv4(),
			...fields,
			status: 'unassigned',
			assignee: null,
		});

		if (isNew) created++;
		else updated++;
	}

	return { created, updated, skipped, processed: reservations.length };
}
