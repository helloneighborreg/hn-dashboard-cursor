import { fetchJson } from '../apiClient';

function stripPendingFileData(answer) {
	if (answer?.type !== 'FileUpload' || !Array.isArray(answer.files)) return answer;
	return {
		...answer,
		files: answer.files.map((file) => {
			if (!file?.base64) return file;
			const { base64, previewUrl, ...rest } = file;
			return rest;
		}),
	};
}

export function collectPendingFileUploads(answers) {
	const fileUploads = [];
	for (const [questionId, answer] of Object.entries(answers || {})) {
		if (answer?.type !== 'FileUpload' || !Array.isArray(answer.files)) continue;
		for (const file of answer.files) {
			if (!file?.base64) continue;
			fileUploads.push({
				questionId,
				base64: file.base64,
				contentType: file.contentType || file.content_type,
				filename: file.filename,
				capturedAt: file.capturedAt || file.captured_at || null,
				captureSource: file.captureSource || file.capture_source || null,
				facingMode: file.facingMode || file.facing_mode || null,
				imageWidth: file.imageWidth || file.image_width || null,
				imageHeight: file.imageHeight || file.image_height || null,
			});
		}
	}
	return fileUploads;
}

function isPendingLocalFile(file) {
	return Boolean(file?.base64 && !file.storage_path && !file.url);
}

function storedFileFromUpload(upload) {
	return {
		storage_path: upload.storage_path || null,
		url: upload.url || null,
		previewUrl: upload.url || null,
		filename: upload.filename || null,
		content_type: upload.content_type || null,
		captured_at: upload.captured_at || null,
	};
}

/** Replace pending camera captures with confirmed storage metadata after upload. */
export function applyUploadedFilesToValues(values, uploads) {
	if (!uploads?.length) return values;
	const next = { ...values };

	for (const upload of uploads) {
		const questionId = upload.questionId;
		if (!questionId) continue;
		const stored = storedFileFromUpload(upload);
		const files = Array.isArray(next[questionId]) ? [...next[questionId]] : [];
		let replaced = false;
		const mapped = files.map((file) => {
			if (!replaced && isPendingLocalFile(file)) {
				replaced = true;
				return stored;
			}
			return file;
		});
		if (!replaced) mapped.push(stored);
		next[questionId] = mapped;
	}

	return next;
}

export function buildChecklistRequestBody({
	values,
	answers,
	submissionId,
	save = false,
	location = null,
	checklistIds,
}) {
	const transportAnswers = {};
	for (const [questionId, answer] of Object.entries(answers || {})) {
		transportAnswers[questionId] = stripPendingFileData(answer);
	}

	return {
		save,
		submission_id: submissionId || null,
		answers: transportAnswers,
		fileUploads: [],
		task_id: values[checklistIds.task] || null,
		reservation_id: values[checklistIds.reservation] || null,
		property_code: values[checklistIds.property] || null,
		guest_name: values[checklistIds.guest] || null,
		cleaner_name: values[checklistIds.cleaner] || null,
		location,
	};
}

async function uploadPendingFiles(apiBasePath, submissionId, fileUploads, { onProgress } = {}) {
	const uploaded = [];
	let done = 0;
	for (const file of fileUploads) {
		const json = await fetchJson(`${apiBasePath}/${submissionId}/files`, {
			method: 'POST',
			body: file,
		});
		if (json?.data?.file) {
			uploaded.push({ questionId: file.questionId, ...json.data.file });
		}
		done += 1;
		onProgress?.(done, fileUploads.length);
	}
	return uploaded;
}

/** Save or submit a checklist, uploading photos one at a time to avoid oversized requests. */
export async function persistChecklist({
	values,
	answers,
	submissionId,
	save = false,
	location = null,
	onProgress = null,
	apiBasePath = '/api/forms/cjc-turn-clean-checklist',
	checklistIds,
}) {
	const fileUploads = collectPendingFileUploads(answers);
	const hadSubmissionId = Boolean(submissionId);
	let uploadedFiles = [];

	// When resuming a draft, upload new photos before saving so a reload never drops them.
	if (hadSubmissionId && fileUploads.length) {
		onProgress?.({ phase: 'upload', done: 0, total: fileUploads.length });
		uploadedFiles = await uploadPendingFiles(apiBasePath, submissionId, fileUploads, {
			onProgress: (done, total) => onProgress?.({ phase: 'upload', done, total }),
		});
	}

	const body = buildChecklistRequestBody({ values, answers, submissionId, save, location, checklistIds });

	const draftJson = await fetchJson(apiBasePath, {
		method: 'POST',
		body: { ...body, save: true },
	});
	if (!draftJson?.data?.id) throw new Error('Could not save checklist');

	const id = draftJson.data.id;

	if (!hadSubmissionId && fileUploads.length) {
		onProgress?.({ phase: 'upload', done: 0, total: fileUploads.length });
		uploadedFiles = await uploadPendingFiles(apiBasePath, id, fileUploads, {
			onProgress: (done, total) => onProgress?.({ phase: 'upload', done, total }),
		});
	}

	const syncedValues = applyUploadedFilesToValues(values, uploadedFiles);

	if (save) {
		return { ...draftJson, uploadedFiles, syncedValues };
	}

	onProgress?.({ phase: 'finalize' });
	const submitJson = await fetchJson(apiBasePath, {
		method: 'POST',
		body: { ...body, save: false, submission_id: id },
	});
	return { ...submitJson, uploadedFiles, syncedValues };
}

/** Remove base64 from captured photos after they have been uploaded. */
export function stripUploadedBase64(values) {
	const next = { ...values };
	for (const [id, val] of Object.entries(next)) {
		if (!Array.isArray(val)) continue;
		next[id] = val.map((file) => {
			if (!file?.base64) return file;
			const { base64, ...rest } = file;
			return rest;
		});
	}
	return next;
}
