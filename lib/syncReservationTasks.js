import { v4 as uuidv4 } from 'uuid';
import { getReservationCode } from './codes';
import { reservationPropertyRecord } from './hospitable';
import {
	buildTaskFromReservation,
	parseReservationCheckout,
	reservationEligibleForTask,
	reservationIsCancelled,
} from './taskFromReservation';
import { upsertTaskFromReservation, deleteTaskForReservationLookup } from './db';
import { withChecklistUrl } from './checklistUrl';
import { notifyTaskScheduleChanged } from './notify';
import { taskScheduleChanged } from './taskSchedule';

/**
 * Create or update local tasks for each reservation (keyed by reservation_id).
 * Cancelled/declined reservations remove their linked task. New tasks are unassigned.
 */
export async function syncTasksFromReservations(reservations, propertyMap = {}) {
	let created = 0;
	let updated = 0;
	let deleted = 0;
	let skipped = 0;

	for (const reservation of reservations) {
		const prop = reservationPropertyRecord(reservation, propertyMap);

		if (reservationIsCancelled(reservation)) {
			const code = getReservationCode(reservation);
			if (!code) {
				skipped++;
				continue;
			}
			const fields = buildTaskFromReservation(reservation, prop);
			const { checkoutDate } = parseReservationCheckout(reservation);
			if (await deleteTaskForReservationLookup({
				reservation_id: code,
				hospitable_reservation_id: reservation.id,
				property_id: reservation.property_id,
				checkout_date: fields?.checkout_date || checkoutDate,
				type: 'turnover',
			})) {
				deleted++;
			} else {
				skipped++;
			}
			continue;
		}

		if (!reservationEligibleForTask(reservation)) {
			skipped++;
			continue;
		}
		const fields = buildTaskFromReservation(reservation, prop);
		if (!fields) {
			skipped++;
			continue;
		}

		const { task, isNew, previousTask } = await upsertTaskFromReservation({
			id: uuidv4(),
			...fields,
			status: 'unassigned',
			assignee: null,
		});

		if (
			!isNew
			&& task?.assignee
			&& previousTask
			&& taskScheduleChanged(previousTask, task)
		) {
			try {
				await notifyTaskScheduleChanged(
					withChecklistUrl(task),
					task.assignee,
					previousTask,
				);
			} catch (err) {
				console.error('Task schedule notify failed:', err.message);
			}
		}

		if (isNew) created++;
		else updated++;
	}

	return { created, updated, deleted, skipped, processed: reservations.length };
}
