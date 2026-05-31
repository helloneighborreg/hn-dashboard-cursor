import { getTaskById, getTaskByReservationId, updateTask } from './db.js';
import { buildCompletionNotes, parseFilloutWebhookPayload } from './filloutWebhook.js';
import { filloutApiConfigured, getFilloutSubmission, resolveFilloutFormIds } from './fillout.js';
import { getChecklistFormKey } from './propertyChecklists.js';
import { notifyIfTaskCompleted } from './notify.js';

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
export function buildFilloutTaskPatch(task, { submissionId, submissionUrl, pdfUrl }, { markCompleted = true } = {}) {
	const patch = {};
	if (markCompleted && task.status !== 'completed') patch.status = 'completed';
	if (submissionId && submissionId !== task.fillout_submission_id) {
		patch.fillout_submission_id = submissionId;
	}
	if (submissionUrl && submissionUrl !== task.checklist_submission_url) {
		patch.checklist_submission_url = submissionUrl;
	}
	if (pdfUrl && pdfUrl !== task.checklist_pdf_url) patch.checklist_pdf_url = pdfUrl;

	const notes = buildCompletionNotes(task.notes, {
		submissionId: submissionId || null,
		submissionUrl: submissionUrl || null,
		pdfUrl: pdfUrl || null,
	});
	if (notes && notes !== task.notes) patch.notes = notes;

	return Object.keys(patch).length ? patch : null;
}

async function fetchSubmissionUrlForTask(task, submissionId) {
	if (!submissionId || !filloutApiConfigured()) return null;

	const formKey = getChecklistFormKey(task.property_name);
	if (!formKey) return null;

	try {
		const formIds = await resolveFilloutFormIds();
		const formId = formIds[formKey];
		if (!formId) return null;

		const submission = await getFilloutSubmission(formId, submissionId, { includeEditLink: true });
		return submission?.editLink?.trim() || null;
	} catch (err) {
		console.warn('Fillout submission URL lookup failed:', err.message);
		return null;
	}
}

export async function resolveFilloutSubmissionUrl(task, { submissionId, submissionUrl }) {
	if (submissionUrl?.trim()) return submissionUrl.trim();

	const id = submissionId || task.fillout_submission_id;
	if (!id || task.checklist_submission_url?.trim()) return task.checklist_submission_url?.trim() || null;

	return fetchSubmissionUrlForTask(task, id);
}

export async function applyFilloutSubmissionToTask(body, options = {}) {
	const { taskId, reservationId, submissionId, submissionUrl, pdfUrl } = parseFilloutSubmission(body);
	const task = await findTaskForFilloutSubmission({ taskId, reservationId });

	if (!task) {
		return { ok: false, error: 'Task not found', taskId, reservationId };
	}

	const resolvedSubmissionUrl = await resolveFilloutSubmissionUrl(task, { submissionId, submissionUrl });

	if (task.status === 'completed' && submissionId && task.fillout_submission_id === submissionId) {
		if (resolvedSubmissionUrl && resolvedSubmissionUrl !== task.checklist_submission_url) {
			const patch = buildFilloutTaskPatch(task, { submissionId, submissionUrl: resolvedSubmissionUrl, pdfUrl }, options);
			if (patch) {
				const updated = await updateTask(task.id, patch);
				return { ok: true, task: updated, updated: true };
			}
		}
		return { ok: true, task, already_completed: true };
	}

	const patch = buildFilloutTaskPatch(
		task,
		{ submissionId, submissionUrl: resolvedSubmissionUrl, pdfUrl },
		options,
	);
	if (!patch) {
		return { ok: true, task, skipped: true };
	}

	const updated = await updateTask(task.id, patch);
	let completionNotified = null;
	try {
		completionNotified = await notifyIfTaskCompleted(task, updated);
	} catch (err) {
		console.error('Task completion notify failed:', err.message);
	}
	return { ok: true, task: updated, updated: true, completionNotified };
}
