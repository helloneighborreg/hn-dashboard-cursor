import { syncTasksFromReservations } from './syncReservationTasks';
import { fetchReservationsForSync } from './hospitable';
import { archiveStaleTasks } from './taskArchive';

/** Pull Hospitable reservations and upsert local turnover tasks. */
export async function runReservationTaskSync({ skipNotify = true } = {}) {
	const { propMap, reservations } = await fetchReservationsForSync();
	const result = await syncTasksFromReservations(reservations, propMap, { skipNotify });
	const archiveResult = await archiveStaleTasks();
	return { ...result, archived: archiveResult.archived };
}
