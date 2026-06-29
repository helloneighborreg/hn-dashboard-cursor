import { getSupabase } from '../supabase.js';
import { CJC_TURN_CLEAN_FORM_ID, CJC_TURN_CLEAN_FORM_SLUG } from './cjcTurnCleanChecklist.js';
import { resolveChecklistFormFromSubmission } from './checklistFormRegistry.js';

export const FORM_SUBMISSION_STATUS = {
	DRAFT: 'draft',
	SUBMITTED: 'submitted',
};

const LOCKED_CHECKLIST_MESSAGE = 'This checklist is complete and locked.';

function lockedChecklistError() {
	const err = new Error(LOCKED_CHECKLIST_MESSAGE);
	err.status = 403;
	return err;
}

export function isSubmissionLocked(submission) {
	return submission?.status === FORM_SUBMISSION_STATUS.SUBMITTED;
}

export function assertSubmissionEditable(submission) {
	if (isSubmissionLocked(submission)) throw lockedChecklistError();
}

function throwDbError(error) {
	throw error;
}

function buildCalculations(answers, formSlug = CJC_TURN_CLEAN_FORM_SLUG) {
	const form = resolveChecklistFormFromSubmission({ form_slug: formSlug });
	const totalId = form.CHECKLIST_IDS.totalAmount;
	return {
		svxB: {
			name: 'Invoice Total',
			value: Number(answers?.[totalId]?.value) || 0,
		},
	};
}

function storedFileKey(file) {
	return file?.storage_path || file?.url || file?.public_url || null;
}

function isStoredFile(file) {
	return Boolean(storedFileKey(file));
}

/** Keep uploaded photos when the client sends stripped FileUpload answers. */
function mergeFileUploadAnswer(existingAnswer, incomingAnswer) {
	const existingFiles = (existingAnswer?.files || []).filter(isStoredFile);
	const incomingFiles = incomingAnswer?.files || [];
	const incomingStored = incomingFiles.filter(isStoredFile);
	const incomingPending = incomingFiles.filter((file) => file?.base64 && !isStoredFile(file));

	const storedByKey = new Map();
	for (const file of existingFiles) {
		const key = storedFileKey(file);
		if (key) storedByKey.set(key, file);
	}
	for (const file of incomingStored) {
		const key = storedFileKey(file);
		if (key) storedByKey.set(key, file);
	}

	return {
		...(incomingAnswer || existingAnswer),
		type: 'FileUpload',
		name: incomingAnswer?.name || existingAnswer?.name || '',
		files: [...storedByKey.values(), ...incomingPending],
	};
}

export function mergeSubmissionAnswers(existingAnswers, incomingAnswers) {
	const merged = { ...(incomingAnswers || {}) };

	for (const [questionId, existingAnswer] of Object.entries(existingAnswers || {})) {
		if (existingAnswer?.type !== 'FileUpload') continue;
		merged[questionId] = mergeFileUploadAnswer(existingAnswer, merged[questionId]);
	}

	return merged;
}

function submissionRow({
	answers,
	taskId = null,
	reservationId = null,
	propertyCode = null,
	guestName = null,
	cleanerName = null,
	submittedBy = null,
	status = FORM_SUBMISSION_STATUS.SUBMITTED,
	formId = CJC_TURN_CLEAN_FORM_ID,
	formSlug = CJC_TURN_CLEAN_FORM_SLUG,
}) {
	return {
		form_id: formId,
		form_slug: formSlug,
		task_id: taskId || null,
		reservation_id: reservationId || null,
		property_code: propertyCode || null,
		guest_name: guestName || null,
		cleaner_name: cleanerName || null,
		answers,
		calculations: buildCalculations(answers, formSlug),
		submitted_by: submittedBy || null,
		status,
	};
}

export async function getFormSubmissionById(id) {
	if (!id) return null;
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('form_submissions')
		.select('*')
		.eq('id', id)
		.maybeSingle();
	if (error) throwDbError(error);
	return data || null;
}

export async function getFormSubmissionForReservation(reservationId, { formSlug = CJC_TURN_CLEAN_FORM_SLUG } = {}) {
	if (!reservationId) return null;
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('form_submissions')
		.select('*')
		.eq('reservation_id', reservationId)
		.eq('form_slug', formSlug)
		.order('submitted_at', { ascending: false })
		.limit(1)
		.maybeSingle();
	if (error) throwDbError(error);
	return data || null;
}

export async function getFormSubmissionForTask(taskId, { formSlug = CJC_TURN_CLEAN_FORM_SLUG } = {}) {
	if (!taskId) return null;
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('form_submissions')
		.select('*')
		.eq('task_id', taskId)
		.eq('form_slug', formSlug)
		.order('submitted_at', { ascending: false })
		.limit(1)
		.maybeSingle();
	if (error) throwDbError(error);
	return data || null;
}

export async function createFormSubmission({
	answers,
	taskId = null,
	reservationId = null,
	propertyCode = null,
	guestName = null,
	cleanerName = null,
	submittedBy = null,
	status = FORM_SUBMISSION_STATUS.SUBMITTED,
	formId = CJC_TURN_CLEAN_FORM_ID,
	formSlug = CJC_TURN_CLEAN_FORM_SLUG,
}) {
	const supabase = getSupabase();
	const row = submissionRow({
		answers,
		taskId,
		reservationId,
		propertyCode,
		guestName,
		cleanerName,
		submittedBy,
		status,
		formId,
		formSlug,
	});

	const { data, error } = await supabase
		.from('form_submissions')
		.insert(row)
		.select('id, form_slug, task_id, reservation_id, submitted_at, status')
		.single();

	if (error) throwDbError(error);
	return data;
}

export async function updateFormSubmission(id, patch) {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('form_submissions')
		.update(patch)
		.eq('id', id)
		.select('id, form_slug, task_id, reservation_id, submitted_at, status')
		.single();
	if (error) throwDbError(error);
	return data;
}

export async function saveFormSubmissionDraft({
	submissionId = null,
	answers,
	taskId = null,
	reservationId = null,
	propertyCode = null,
	guestName = null,
	cleanerName = null,
	submittedBy = null,
	formId = CJC_TURN_CLEAN_FORM_ID,
	formSlug = CJC_TURN_CLEAN_FORM_SLUG,
}) {
	if (submissionId) {
		const existing = await getFormSubmissionById(submissionId);
		if (!existing) {
			const err = new Error('Saved checklist not found');
			err.status = 404;
			throw err;
		}
		assertSubmissionEditable(existing);
		const mergedAnswers = mergeSubmissionAnswers(existing.answers, answers);
		const slug = existing.form_slug || formSlug;
		return updateFormSubmission(submissionId, {
			answers: mergedAnswers,
			calculations: buildCalculations(mergedAnswers, slug),
			task_id: taskId || existing.task_id,
			reservation_id: reservationId || existing.reservation_id,
			property_code: propertyCode || existing.property_code,
			guest_name: guestName || existing.guest_name,
			cleaner_name: cleanerName || existing.cleaner_name,
			status: FORM_SUBMISSION_STATUS.DRAFT,
		});
	}

	if (reservationId) {
		const existing = await getFormSubmissionForReservation(reservationId, { formSlug });
		if (existing) {
			assertSubmissionEditable(existing);
			const mergedAnswers = mergeSubmissionAnswers(existing.answers, answers);
			const slug = existing.form_slug || formSlug;
			return updateFormSubmission(existing.id, {
				answers: mergedAnswers,
				calculations: buildCalculations(mergedAnswers, slug),
				task_id: taskId || existing.task_id,
				reservation_id: reservationId || existing.reservation_id,
				property_code: propertyCode || existing.property_code,
				guest_name: guestName || existing.guest_name,
				cleaner_name: cleanerName || existing.cleaner_name,
				status: FORM_SUBMISSION_STATUS.DRAFT,
			});
		}
	}

	if (taskId) {
		const existing = await getFormSubmissionForTask(taskId, { formSlug });
		if (existing) {
			assertSubmissionEditable(existing);
			const mergedAnswers = mergeSubmissionAnswers(existing.answers, answers);
			const slug = existing.form_slug || formSlug;
			return updateFormSubmission(existing.id, {
				answers: mergedAnswers,
				calculations: buildCalculations(mergedAnswers, slug),
				reservation_id: reservationId || existing.reservation_id,
				property_code: propertyCode || existing.property_code,
				guest_name: guestName || existing.guest_name,
				cleaner_name: cleanerName || existing.cleaner_name,
				status: FORM_SUBMISSION_STATUS.DRAFT,
			});
		}
	}

	return createFormSubmission({
		answers,
		taskId,
		reservationId,
		propertyCode,
		guestName,
		cleanerName,
		submittedBy,
		status: FORM_SUBMISSION_STATUS.DRAFT,
		formId,
		formSlug,
	});
}

export async function submitFormSubmission({
	submissionId = null,
	answers,
	taskId = null,
	reservationId = null,
	propertyCode = null,
	guestName = null,
	cleanerName = null,
	submittedBy = null,
	formId = CJC_TURN_CLEAN_FORM_ID,
	formSlug = CJC_TURN_CLEAN_FORM_SLUG,
}) {
	const patch = {
		answers,
		calculations: buildCalculations(answers, formSlug),
		status: FORM_SUBMISSION_STATUS.SUBMITTED,
		submitted_at: new Date().toISOString(),
	};

	if (submissionId) {
		const existing = await getFormSubmissionById(submissionId);
		if (!existing) {
			const err = new Error('Saved checklist not found');
			err.status = 404;
			throw err;
		}
		if (existing.status === FORM_SUBMISSION_STATUS.SUBMITTED) {
			const err = new Error('This checklist has already been submitted.');
			err.status = 403;
			throw err;
		}
		const mergedAnswers = mergeSubmissionAnswers(existing.answers, answers);
		const slug = existing.form_slug || formSlug;
		return updateFormSubmission(submissionId, {
			...patch,
			answers: mergedAnswers,
			calculations: buildCalculations(mergedAnswers, slug),
			task_id: taskId || existing.task_id,
			reservation_id: reservationId || existing.reservation_id,
			property_code: propertyCode || existing.property_code,
			guest_name: guestName || existing.guest_name,
			cleaner_name: cleanerName || existing.cleaner_name,
			submitted_by: submittedBy || existing.submitted_by,
		});
	}

	if (reservationId) {
		const existing = await getFormSubmissionForReservation(reservationId, { formSlug });
		if (existing?.status === FORM_SUBMISSION_STATUS.DRAFT) {
			const mergedAnswers = mergeSubmissionAnswers(existing.answers, answers);
			const slug = existing.form_slug || formSlug;
			return updateFormSubmission(existing.id, {
				...patch,
				answers: mergedAnswers,
				calculations: buildCalculations(mergedAnswers, slug),
				task_id: taskId || existing.task_id,
				reservation_id: reservationId,
				property_code: propertyCode || existing.property_code,
				guest_name: guestName || existing.guest_name,
				cleaner_name: cleanerName || existing.cleaner_name,
				submitted_by: submittedBy || existing.submitted_by,
			});
		}
		if (existing?.status === FORM_SUBMISSION_STATUS.SUBMITTED) {
			const err = new Error('This checklist has already been submitted.');
			err.status = 403;
			throw err;
		}
	}

	if (taskId) {
		const existing = await getFormSubmissionForTask(taskId, { formSlug });
		if (existing?.status === FORM_SUBMISSION_STATUS.DRAFT) {
			const mergedAnswers = mergeSubmissionAnswers(existing.answers, answers);
			const slug = existing.form_slug || formSlug;
			return updateFormSubmission(existing.id, {
				...patch,
				answers: mergedAnswers,
				calculations: buildCalculations(mergedAnswers, slug),
				task_id: taskId,
				reservation_id: reservationId || existing.reservation_id,
				property_code: propertyCode || existing.property_code,
				guest_name: guestName || existing.guest_name,
				cleaner_name: cleanerName || existing.cleaner_name,
				submitted_by: submittedBy || existing.submitted_by,
			});
		}
		if (existing?.status === FORM_SUBMISSION_STATUS.SUBMITTED) {
			const err = new Error('This checklist has already been submitted.');
			err.status = 403;
			throw err;
		}
	}

	return createFormSubmission({
		answers,
		taskId,
		reservationId,
		propertyCode,
		guestName,
		cleanerName,
		submittedBy,
		status: FORM_SUBMISSION_STATUS.SUBMITTED,
		formId,
		formSlug,
	});
}

export async function unlockFormSubmission(submissionId) {
	const existing = await getFormSubmissionById(submissionId);
	if (!existing) {
		const err = new Error('Checklist not found');
		err.status = 404;
		throw err;
	}
	if (existing.status !== FORM_SUBMISSION_STATUS.SUBMITTED) {
		return existing;
	}
	return updateFormSubmission(submissionId, {
		status: FORM_SUBMISSION_STATUS.DRAFT,
	});
}

export async function insertFormSubmissionFiles(submissionId, files) {
	if (!files?.length) return [];
	const supabase = getSupabase();
	const rows = files.map((f) => ({
		submission_id: submissionId,
		question_id: f.question_id,
		storage_path: f.storage_path,
		filename: f.filename || null,
		content_type: f.content_type || null,
		public_url: f.url || null,
	}));

	const { data, error } = await supabase
		.from('form_submission_files')
		.insert(rows)
		.select('id, question_id, storage_path, public_url');

	if (error) throwDbError(error);
	return data || [];
}

export async function updateFormSubmissionAnswers(submissionId, answers) {
	return updateFormSubmission(submissionId, { answers });
}

function mergeFileIntoAnswers(answers, questionId, file) {
	const merged = { ...(answers || {}) };
	const existing = merged[questionId]?.files || [];
	merged[questionId] = {
		...(merged[questionId] || { type: 'FileUpload', name: questionId, files: [] }),
		files: [
			...existing,
			{
				storage_path: file.storage_path,
				url: file.url,
				filename: file.filename,
				content_type: file.content_type,
				captured_at: file.captured_at || null,
				capture_source: file.capture_source || null,
				facing_mode: file.facing_mode || null,
				image_width: file.image_width ?? null,
				image_height: file.image_height ?? null,
			},
		],
	};
	return merged;
}

export async function appendSubmissionFile(submissionId, questionId, storedFile) {
	const existing = await getFormSubmissionById(submissionId);
	if (!existing) {
		const err = new Error('Saved checklist not found');
		err.status = 404;
		throw err;
	}
	assertSubmissionEditable(existing);

	await insertFormSubmissionFiles(submissionId, [{
		question_id: questionId,
		...storedFile,
	}]);

	const answers = mergeFileIntoAnswers(existing.answers, questionId, storedFile);
	return updateFormSubmissionAnswers(submissionId, answers);
}

export function buildSubmissionViewUrl(submission) {
	const record = typeof submission === 'string' ? { id: submission } : submission;
	const form = resolveChecklistFormFromSubmission(record);
	return form.buildSubmissionViewUrl(record.id);
}
