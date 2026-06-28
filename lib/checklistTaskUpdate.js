import { getTaskById, getTaskByReservationId, updateTask } from './db.js';
import {
	buildSubmissionViewUrl,
	getFormSubmissionById,
} from './forms/checklistSubmissions.js';
import { buildChecklistPdfBytes, checklistPdfApiUrl } from './forms/checklistPdf.js';
import { uploadChecklistPdf } from './forms/checklistFormStorage.js';
import { taskCheckoutIsFuture } from './dates.js';
import { notifyIfTaskCompleted } from './notify.js';
import { syncBillpayForTaskUpdate } from './billpaySync.js';

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
export function buildChecklistTaskPatch(task, { submissionUrl, pdfUrl }, { markCompleted = true } = {}) {
	const patch = {};
	if (markCompleted && task.status !== 'completed') {
		patch.status = 'completed';
	}
	if (submissionUrl && submissionUrl !== task.checklist_submission_url) {
		patch.checklist_submission_url = submissionUrl;
	}
	if (pdfUrl && pdfUrl !== task.checklist_pdf_url) {
		patch.checklist_pdf_url = pdfUrl;
	}
	return Object.keys(patch).length ? patch : null;
}

async function generateAndStoreChecklistPdf(submissionId) {
	const submission = await getFormSubmissionById(submissionId);
	if (!submission) return null;
	const bytes = await buildChecklistPdfBytes(submission);
	await uploadChecklistPdf(submissionId, bytes);
	return checklistPdfApiUrl(submissionId);
}

/** Record when a cleaner first saves/opens a checklist draft for this task. */
export async function markTaskChecklistStarted(taskId) {
	if (!isUuid(taskId)) return null;
	const task = await getTaskById(taskId);
	if (!task || task.started_at) return task;
	return updateTask(task.id, { started_at: new Date().toISOString() }, { previousTask: task });
}

/**
 * Link a submitted in-app checklist to its task (status → completed, submission URL, PDF).
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
	let pdfUrl = null;
	try {
		pdfUrl = await generateAndStoreChecklistPdf(submissionId);
	} catch (err) {
		console.error('Checklist PDF generation failed:', err.message);
	}

	const wouldComplete = task.status !== 'completed';
	const skipCompletion = wouldComplete && taskCheckoutIsFuture(task);
	const patch = buildChecklistTaskPatch(task, { submissionUrl, pdfUrl }, { markCompleted: wouldComplete && !skipCompletion });
	if (!patch) {
		return { ok: true, task, skipped: true, completionSkipped: skipCompletion ? 'future_checkout' : undefined };
	}

	const updated = await updateTask(task.id, patch, { previousTask: task });
	let notified = null;
	if (!skipNotify && wouldComplete && !skipCompletion) {
		try {
			notified = await notifyIfTaskCompleted(task, updated);
		} catch (err) {
			console.error('Checklist task notify failed:', err.message);
		}
	}
	try {
		await syncBillpayForTaskUpdate(task, updated);
	} catch (err) {
		console.error('Billpay sync failed:', err.message);
	}
	return {
		ok: true,
		task: updated,
		updated: true,
		notified,
		pdfUrl,
		completionSkipped: skipCompletion ? 'future_checkout' : undefined,
	};
}
