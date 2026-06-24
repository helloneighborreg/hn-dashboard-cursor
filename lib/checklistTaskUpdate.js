import { getTaskById, getTaskByReservationId, updateTask } from './db.js';
import { buildSubmissionViewUrl } from './forms/checklistSubmissions.js';
import { notifyIfTaskSubmitted } from './notify.js';

function isUuid(value) {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
}

export async function findTaskForChecklistSubmission({ taskId, reservationId }) {
	if (taskId && isUuid(taskId)) {
		const task = await getTaskById(taskId);
		if (task) return task;
	}
	if (reservationId) {
		return getTaskByReservationId(reservationId);
	}
	return null;
}

/** Patch a task when an in-app checklist is submitted. */
export function buildChecklistTaskPatch(task, { submissionUrl }, { markSubmitted = true } = {}) {
	const patch = {};
	if (markSubmitted && task.status !== 'under_review' && task.status !== 'completed') {
		patch.status = 'under_review';
	}
	if (submissionUrl && submissionUrl !== task.checklist_submission_url) {
		patch.checklist_submission_url = submissionUrl;
	}
	return Object.keys(patch).length ? patch : null;
}

/**
 * Link a submitted in-app checklist to its task (status → under_review, submission URL).
 * Links in-app checklist submissions to dashboard tasks.
 */
export async function applyChecklistSubmissionToTask({
	submissionId,
	taskId = null,
	reservationId = null,
}, { skipNotify = false } = {}) {
	const task = await findTaskForChecklistSubmission({ taskId, reservationId });
	if (!task) {
		return { ok: false, error: 'Task not found', taskId, reservationId };
	}

	const submissionUrl = buildSubmissionViewUrl(submissionId);
	const markSubmitted = task.status !== 'completed';
	const patch = buildChecklistTaskPatch(task, { submissionUrl }, { markSubmitted });
	if (!patch) {
		return { ok: true, task, skipped: true };
	}

	const updated = await updateTask(task.id, patch);
	let notified = null;
	if (!skipNotify && markSubmitted) {
		try {
			notified = await notifyIfTaskSubmitted(task, updated);
		} catch (err) {
			console.error('Checklist task notify failed:', err.message);
		}
	}
	return { ok: true, task: updated, updated: true, notified };
}
