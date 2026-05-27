import { getTaskById, getTaskByReservationId, updateTask } from './db.js';
import { buildCompletionNotes, parseFilloutWebhookPayload } from './filloutWebhook.js';

/** Normalize a Fillout API submission or webhook body into task fields. */
export function parseFilloutSubmission(body) {
	if (body?.submission) return parseFilloutWebhookPayload(body);
	if (body?.urlParameters || body?.questions || body?.submissionId) {
		return parseFilloutWebhookPayload({ submission: body });
	}
	return parseFilloutWebhookPayload(body);
}

function isUuid(value) {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function reservationFromLegacyTaskId(taskId) {
	const match = String(taskId || '').match(/^CLN-([A-Z0-9]+)-/i);
	return match?.[1]?.toUpperCase() || null;
}

export async function findTaskForFilloutSubmission({ taskId, reservationId }) {
	if (taskId && isUuid(taskId)) {
		const task = await getTaskById(taskId);
		if (task) return task;
	}

	const bookingCode = reservationId || reservationFromLegacyTaskId(taskId);
	if (bookingCode) return getTaskByReservationId(bookingCode);
	return null;
}

/** Apply Fillout submission data to a task row. Returns null if nothing to change. */
export function buildFilloutTaskPatch(task, { submissionId, pdfUrl }, { markCompleted = true } = {}) {
	const patch = {};
	if (markCompleted && task.status !== 'completed') patch.status = 'completed';
	if (submissionId && submissionId !== task.fillout_submission_id) {
		patch.fillout_submission_id = submissionId;
	}
	if (pdfUrl && pdfUrl !== task.checklist_pdf_url) patch.checklist_pdf_url = pdfUrl;

	const notes = buildCompletionNotes(task.notes, {
		submissionId: submissionId || null,
		pdfUrl: pdfUrl || null,
	});
	if (notes && notes !== task.notes) patch.notes = notes;

	return Object.keys(patch).length ? patch : null;
}

export async function applyFilloutSubmissionToTask(body, options = {}) {
	const { taskId, reservationId, submissionId, pdfUrl } = parseFilloutSubmission(body);
	const task = await findTaskForFilloutSubmission({ taskId, reservationId });

	if (!task) {
		return { ok: false, error: 'Task not found', taskId, reservationId };
	}

	if (task.status === 'completed' && submissionId && task.fillout_submission_id === submissionId) {
		return { ok: true, task, already_completed: true };
	}

	const patch = buildFilloutTaskPatch(task, { submissionId, pdfUrl }, options);
	if (!patch) {
		return { ok: true, task, skipped: true };
	}

	const updated = await updateTask(task.id, patch);
	return { ok: true, task: updated, updated: true };
}
