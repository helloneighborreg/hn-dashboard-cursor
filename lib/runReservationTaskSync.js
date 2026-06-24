import { syncTasksFromReservations } from './syncReservationTasks';
import { fetchReservationsForSync } from './hospitable';
import { clearCache } from './cache';

/** Pull Hospitable reservations and upsert local turnover tasks. */
export async function runReservationTaskSync({ skipNotify = true } = {}) {
	const { propMap, reservations } = await fetchReservationsForSync();
	const result = await syncTasksFromReservations(reservations, propMap, { skipNotify });
	clearCache('dashboard');
	return result;
}
