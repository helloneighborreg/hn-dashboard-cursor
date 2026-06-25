import { getTaskById, getTaskByReservationId, updateTask } from './db.js';
import { buildCompletionNotes, parseFilloutWebhookPayload } from './filloutWebhook.js';
import { filloutApiConfigured, getFilloutSubmission, resolveFilloutFormIds } from './fillout.js';
import { getChecklistFormKey } from './propertyChecklists.js';

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
export function buildFilloutTaskPatch(task, { submissionId, submissionUrl, pdfUrl }, { markSubmitted = true } = {}) {
	const patch = {};
	if (markSubmitted && task.status !== 'completed') {
		patch.status = 'completed';
	}
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

async function fetchSubmissionDetailsForTask(task, submissionId) {
	if (!submissionId || !filloutApiConfigured()) {
		return { submissionUrl: null, pdfUrl: null };
	}

	const formKey = getChecklistFormKey(task.property_name);
	if (!formKey) return { submissionUrl: null, pdfUrl: null };

	try {
		const formIds = await resolveFilloutFormIds();
		const formId = formIds[formKey];
		if (!formId) return { submissionUrl: null, pdfUrl: null };

		const raw = await getFilloutSubmission(formId, submissionId, { includeEditLink: true });
		const parsed = parseFilloutSubmission({
			submission: raw.submission || raw,
			editLink: raw.editLink,
		});
		return {
			submissionUrl: parsed.submissionUrl || raw.editLink?.trim() || null,
			pdfUrl: parsed.pdfUrl || null,
		};
	} catch (err) {
		console.warn('Fillout submission lookup failed:', err.message);
		return { submissionUrl: null, pdfUrl: null };
	}
}

async function fetchSubmissionUrlForTask(task, submissionId) {
	const { submissionUrl } = await fetchSubmissionDetailsForTask(task, submissionId);
	return submissionUrl;
}

export async function resolveFilloutSubmissionUrl(task, { submissionId, submissionUrl }) {
	if (submissionUrl?.trim()) return submissionUrl.trim();

	const id = submissionId || task.fillout_submission_id;
	if (!id || task.checklist_submission_url?.trim()) return task.checklist_submission_url?.trim() || null;

	return fetchSubmissionUrlForTask(task, id);
}

/** True when the payload includes evidence of a real Fillout submission (not just task lookup IDs). */
export function hasFilloutSubmissionPayload({ submissionId, submissionUrl, pdfUrl }, taskId) {
	if (pdfUrl?.trim()) return true;
	if (submissionUrl?.trim()) return true;
	const id = submissionId?.trim();
	if (!id) return false;
	// Ignore task UUID mistaken for submission id (Fillout/Notion url param `id`).
	if (taskId && id === taskId) return false;
	return true;
}

export async function applyFilloutSubmissionToTask(body, options = {}) {
	const { skipNotify = false } = options;
	const { taskId, reservationId, submissionId, submissionUrl, pdfUrl } = parseFilloutSubmission(body);
	const task = await findTaskForFilloutSubmission({ taskId, reservationId });

	if (!task) {
		return { ok: false, error: 'Task not found', taskId, reservationId };
	}

	if (
		task.status !== 'completed'
		&& !hasFilloutSubmissionPayload({ submissionId, submissionUrl, pdfUrl }, task.id)
	) {
		return { ok: true, task, verified: true, updated: false };
	}

	const resolvedSubmissionId = submissionId || task.fillout_submission_id;
	let resolvedSubmissionUrl = await resolveFilloutSubmissionUrl(task, { submissionId, submissionUrl });
	let resolvedPdfUrl = pdfUrl || task.checklist_pdf_url || null;

	if (
		resolvedSubmissionId
		&& filloutApiConfigured()
		&& (!resolvedPdfUrl || !resolvedSubmissionUrl)
	) {
		const fetched = await fetchSubmissionDetailsForTask(task, resolvedSubmissionId);
		if (!resolvedSubmissionUrl) resolvedSubmissionUrl = fetched.submissionUrl;
		if (!resolvedPdfUrl) resolvedPdfUrl = fetched.pdfUrl;
	}

	if (task.status === 'completed') {
		const patch = buildFilloutTaskPatch(
			task,
			{
				submissionId: resolvedSubmissionId,
				submissionUrl: resolvedSubmissionUrl,
				pdfUrl: resolvedPdfUrl,
			},
			{ ...options, markCompleted: false },
		);
		if (patch) {
			const updated = await updateTask(task.id, patch);
			return { ok: true, task: updated, updated: true, already_completed: true };
		}
		return { ok: true, task, already_completed: true };
	}

	const patch = buildFilloutTaskPatch(
		task,
		{
			submissionId: resolvedSubmissionId,
			submissionUrl: resolvedSubmissionUrl,
			pdfUrl: resolvedPdfUrl,
		},
		options,
	);
	if (!patch) {
		return { ok: true, task, skipped: true };
	}

	const updated = await updateTask(task.id, patch);
	let completionNotified = null;
	if (!skipNotify) {
		try {
			completionNotified = await notifyIfTaskCompleted(task, updated);
		} catch (err) {
			console.error('Task completion notify failed:', err.message);
		}
	}
	return { ok: true, task: updated, updated: true, completionNotified };
}
