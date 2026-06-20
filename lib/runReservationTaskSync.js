import { syncTasksFromReservations } from './syncReservationTasks';
import { fetchReservationsForSync } from './hospitable';

/** Pull Hospitable reservations and upsert local turnover tasks. */
export async function runReservationTaskSync({ skipNotify = true } = {}) {
	const { propMap, reservations } = await fetchReservationsForSync();
	return syncTasksFromReservations(reservations, propMap, { skipNotify });
}
