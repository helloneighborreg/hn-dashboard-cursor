import { v4 as uuidv4 } from 'uuid';
import { getReservationCode } from './codes';
import { reservationPropertyRecord } from './hospitable';
import {
	buildTaskFromReservation,
	buildSchedulePatchFromReservation,
	parseReservationCheckout,
	reservationEligibleForTask,
	reservationActsAsCancelled,
	isPastTurnoverCheckout,
} from './taskFromReservation';
import { todayIso } from './dates';
import { isTaskAssigned } from './constants';
import {
	loadTurnoverTasksForSync,
	applySyncMutations,
	patchTaskScheduleFromReservation,
	deleteTaskForCancelledReservation,
	deleteTask,
	findExistingTaskForReservation,
	upsertTaskFromReservation,
} from './db';
import {
	buildTurnoverTaskIndex,
	findTaskInIndex,
	findTaskForCancelled,
	addTaskToIndex,
	removeTaskFromIndex,
} from './taskSyncIndex';
import { withChecklistUrl } from './checklistUrl';
import { notifyTaskBookingChanged } from './notify';
import { bookingUpdateSummary, taskSyncRowChanged } from './syncResultMessage';
import { taskBookingChanged } from './taskSchedule';

const RESERVATION_SYNC_FIELDS = [
	'reservation_id',
	'hospitable_reservation_id',
	'property_id',
	'property_name',
	'guest_name',
	'has_pets',
	'pet_count',
	'checklist_url',
	'title',
	'description',
	'checkin_date',
	'checkin_time',
	'due_date',
	'due_time',
	'checkout_date',
	'start_time',
];

function timestamp() {
	return new Date().toISOString();
}

function mergeReservationFields(existing, task) {
	const patch = { updated_at: timestamp() };
	RESERVATION_SYNC_FIELDS.forEach((k) => {
		if (task[k] !== undefined) patch[k] = task[k];
	});
	return { ...existing, ...patch };
}

function mergeScheduleFields(existing, patch) {
	const row = { updated_at: timestamp() };
	[
		'hospitable_reservation_id',
		'property_id',
		'checkin_date',
		'checkin_time',
		'checkout_date',
		'due_date',
		'due_time',
		'start_time',
	].forEach((k) => {
		if (patch[k] !== undefined) row[k] = patch[k];
	});
	return { ...existing, ...row };
}

function upsertInMemory(task, index, mutations) {
	const existing = findTaskInIndex(task, index, { allowPropertyDateFallback: true });

	if (existing) {
		const merged = mergeReservationFields(existing, task);
		if (taskSyncRowChanged(existing, merged)) {
			mutations.updates.push(merged);
			removeTaskFromIndex(index, existing);
			addTaskToIndex(index, merged);
		}
		return { task: merged, isNew: false, previousTask: existing };
	}

	const ts = timestamp();
	const created = {
		...task,
		status: 'unassigned',
		assignee: null,
		scheduled_by: task.scheduled_by || 'Reservations sync',
		created_at: ts,
		updated_at: ts,
	};
	mutations.inserts.push(created);
	addTaskToIndex(index, created);
	return { task: created, isNew: true, previousTask: null };
}

function patchScheduleInMemory(patch, index, mutations) {
	const existing = findTaskInIndex(patch, index, { allowPropertyDateFallback: false });
	if (!existing) return { task: null, updated: false, previousTask: null };

	const merged = mergeScheduleFields(existing, patch);
	const changed = taskSyncRowChanged(existing, merged);
	if (changed) {
		mutations.updates.push(merged);
		removeTaskFromIndex(index, existing);
		addTaskToIndex(index, merged);
	}
	return { task: merged, updated: changed, previousTask: existing, isNew: false };
}

function deleteCancelledInMemory(lookup, index, mutations, { code, hospitableId }) {
	const existing = findTaskForCancelled(lookup, index, { code, hospitableId });
	if (!existing) return false;
	mutations.deleteIds.push(existing.id);
	removeTaskFromIndex(index, existing);
	return true;
}

function turnoverLookup(fields) {
	return {
		reservation_id: fields.reservation_id,
		hospitable_reservation_id: fields.hospitable_reservation_id,
		property_id: fields.property_id,
		checkout_date: fields.checkout_date,
		type: 'turnover',
	};
}

/**
 * Past checkouts should not spawn new tasks. Stale unassigned rows are removed;
 * assigned rows stay for the overdue list.
 * @returns {'proceed' | 'skip' | 'deleted-stale'}
 */
function pastCheckoutSyncAction(reservation, existing, today = todayIso()) {
	if (!isPastTurnoverCheckout(reservation, today)) return 'proceed';
	if (!existing) return 'skip';
	if (existing.status === 'completed') return 'skip';
	if (!isTaskAssigned(existing)) return 'deleted-stale';
	return 'proceed';
}

/** Remove orphan unassigned turnover tasks whose checkout/due date is in the past. */
function pruneStaleTurnoverTasks(index, mutations, today = todayIso()) {
	let pruned = 0;
	for (const task of [...index.all]) {
		if (task.status === 'completed' || isTaskAssigned(task)) continue;
		const due = task.checkout_date || task.due_date;
		if (!due || due >= today) continue;
		mutations.deleteIds.push(task.id);
		removeTaskFromIndex(index, task);
		pruned += 1;
	}
	return pruned;
}

/**
 * Create or update local tasks for each reservation (keyed by reservation_id).
 * Cancelled/declined/expired reservations remove their linked task. New tasks are unassigned.
 *
 * Uses one DB read + batched writes to stay under Cloudflare Workers subrequest limits.
 */
export async function syncTasksFromReservations(reservations, propertyMap = {}, options = {}) {
	const { skipNotify = false, batched = true } = options;

	if (!batched || reservations.length === 1) {
		return syncTasksFromReservationsSequential(reservations, propertyMap, { skipNotify });
	}

	let created = 0;
	let updated = 0;
	let deleted = 0;
	let skipped = 0;
	const booking_updates = [];
	const mutations = { inserts: [], updates: [], deleteIds: [] };
	const index = buildTurnoverTaskIndex(await loadTurnoverTasksForSync());
	const today = todayIso();

	for (const reservation of reservations) {
		const prop = reservationPropertyRecord(reservation, propertyMap);

		if (reservationActsAsCancelled(reservation)) {
			const code = getReservationCode(reservation);
			if (!code) {
				skipped++;
				continue;
			}
			const fields = buildTaskFromReservation(reservation, prop);
			const { checkoutDate } = parseReservationCheckout(reservation);
			if (deleteCancelledInMemory(
				{
					reservation_id: code,
					hospitable_reservation_id: reservation.id,
					property_id: fields?.property_id ?? reservation.property_id,
					checkout_date: fields?.checkout_date || checkoutDate,
					type: 'turnover',
				},
				index,
				mutations,
				{ code, hospitableId: reservation.id },
			)) {
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

		const fields = buildTaskFromReservation(reservation, prop, propertyMap);
		let task;
		let isNew;
		let previousTask;

		if (fields) {
			const existing = findTaskInIndex(turnoverLookup(fields), index, { allowPropertyDateFallback: true });
			const pastAction = pastCheckoutSyncAction(reservation, existing, today);
			if (pastAction === 'skip') {
				skipped++;
				continue;
			}
			if (pastAction === 'deleted-stale') {
				mutations.deleteIds.push(existing.id);
				removeTaskFromIndex(index, existing);
				deleted++;
				continue;
			}

			({ task, isNew, previousTask } = upsertInMemory(
				{ id: uuidv4(), ...fields, status: 'unassigned', assignee: null },
				index,
				mutations,
			));
		} else {
			const schedulePatch = buildSchedulePatchFromReservation(reservation);
			if (!schedulePatch) {
				skipped++;
				continue;
			}
			const existing = findTaskInIndex(turnoverLookup(schedulePatch), index, { allowPropertyDateFallback: false });
			const pastAction = pastCheckoutSyncAction(reservation, existing, today);
			if (pastAction === 'skip') {
				skipped++;
				continue;
			}
			if (pastAction === 'deleted-stale') {
				mutations.deleteIds.push(existing.id);
				removeTaskFromIndex(index, existing);
				deleted++;
				continue;
			}

			const result = patchScheduleInMemory(schedulePatch, index, mutations);
			if (!result.updated) {
				skipped++;
				continue;
			}
			({ task, isNew, previousTask } = { ...result, isNew: false });
		}

		if (!skipNotify && !isNew && previousTask && taskBookingChanged(previousTask, task)) {
			const summary = bookingUpdateSummary(previousTask, task);
			if (summary) booking_updates.push(summary);

			try {
				await notifyTaskBookingChanged(
					withChecklistUrl(task),
					previousTask,
					task.assignee,
				);
			} catch (err) {
				console.error('Task schedule notify failed:', err.message);
			}
		}

		if (isNew) created++;
		else if (previousTask && taskSyncRowChanged(previousTask, task)) updated++;
	}

	deleted += pruneStaleTurnoverTasks(index, mutations, today);

	await applySyncMutations(mutations);

	return {
		created,
		updated,
		deleted,
		skipped,
		booking_updates,
		processed: reservations.length,
	};
}

/** Per-row sync (single reservation / tests). */
async function syncTasksFromReservationsSequential(reservations, propertyMap = {}, { skipNotify = false } = {}) {
	let created = 0;
	let updated = 0;
	let deleted = 0;
	let skipped = 0;
	const booking_updates = [];
	const today = todayIso();

	for (const reservation of reservations) {
		const prop = reservationPropertyRecord(reservation, propertyMap);

		if (reservationActsAsCancelled(reservation)) {
			const code = getReservationCode(reservation);
			if (!code) {
				skipped++;
				continue;
			}
			const fields = buildTaskFromReservation(reservation, prop);
			const { checkoutDate } = parseReservationCheckout(reservation);
			if (await deleteTaskForCancelledReservation(
				{
					reservation_id: code,
					hospitable_reservation_id: reservation.id,
					property_id: fields?.property_id ?? reservation.property_id,
					checkout_date: fields?.checkout_date || checkoutDate,
					type: 'turnover',
				},
				{ code, hospitableId: reservation.id },
			)) {
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
		const fields = buildTaskFromReservation(reservation, prop, propertyMap);
		let task;
		let isNew;
		let previousTask;

		if (fields) {
			const existing = await findExistingTaskForReservation(turnoverLookup(fields), {
				allowPropertyDateFallback: true,
			});
			const pastAction = pastCheckoutSyncAction(reservation, existing, today);
			if (pastAction === 'skip') {
				skipped++;
				continue;
			}
			if (pastAction === 'deleted-stale') {
				await deleteTask(existing.id);
				deleted++;
				continue;
			}

			({ task, isNew, previousTask } = await upsertTaskFromReservation({
				id: uuidv4(),
				...fields,
				status: 'unassigned',
				assignee: null,
			}));
		} else {
			const schedulePatch = buildSchedulePatchFromReservation(reservation);
			if (!schedulePatch) {
				skipped++;
				continue;
			}
			const existing = await findExistingTaskForReservation(turnoverLookup(schedulePatch), {
				allowPropertyDateFallback: false,
			});
			const pastAction = pastCheckoutSyncAction(reservation, existing, today);
			if (pastAction === 'skip') {
				skipped++;
				continue;
			}
			if (pastAction === 'deleted-stale') {
				await deleteTask(existing.id);
				deleted++;
				continue;
			}

			const result = await patchTaskScheduleFromReservation(schedulePatch);
			if (!result.updated) {
				skipped++;
				continue;
			}
			({ task, isNew, previousTask } = { ...result, isNew: false });
		}

		if (!skipNotify && !isNew && previousTask && taskBookingChanged(previousTask, task)) {
			const summary = bookingUpdateSummary(previousTask, task);
			if (summary) booking_updates.push(summary);

			try {
				await notifyTaskBookingChanged(
					withChecklistUrl(task),
					previousTask,
					task.assignee,
				);
			} catch (err) {
				console.error('Task schedule notify failed:', err.message);
			}
		}

		if (isNew) created++;
		else if (previousTask && taskSyncRowChanged(previousTask, task)) updated++;
	}

	return {
		created,
		updated,
		deleted,
		skipped,
		booking_updates,
		processed: reservations.length,
	};
}
