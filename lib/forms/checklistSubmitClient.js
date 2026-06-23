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

export function buildChecklistRequestBody({
	values,
	answers,
	submissionId,
	save = false,
	location = null,
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
		task_id: values['nqZp'] || null,
		reservation_id: values['cdyd'] || null,
		property_code: values['jXsd'] || null,
		guest_name: values['2h8B'] || null,
		cleaner_name: values['kKyP'] || null,
		location,
	};
}

async function uploadPendingFiles(submissionId, fileUploads, { onProgress } = {}) {
	let done = 0;
	for (const file of fileUploads) {
		await fetchJson(`/api/forms/cjc-turn-clean-checklist/${submissionId}/files`, {
			method: 'POST',
			body: file,
		});
		done += 1;
		onProgress?.(done, fileUploads.length);
	}
}

/** Save or submit a checklist, uploading photos one at a time to avoid oversized requests. */
export async function persistChecklist({
	values,
	answers,
	submissionId,
	save = false,
	location = null,
	onProgress = null,
}) {
	const fileUploads = collectPendingFileUploads(answers);
	const body = buildChecklistRequestBody({ values, answers, submissionId, save, location });

	const draftJson = await fetchJson('/api/forms/cjc-turn-clean-checklist', {
		method: 'POST',
		body: { ...body, save: true },
	});
	if (!draftJson?.data?.id) throw new Error('Could not save checklist');

	const id = draftJson.data.id;
	if (fileUploads.length) {
		onProgress?.({ phase: 'upload', done: 0, total: fileUploads.length });
		await uploadPendingFiles(id, fileUploads, {
			onProgress: (done, total) => onProgress?.({ phase: 'upload', done, total }),
		});
	}

	if (save) {
		return draftJson;
	}

	onProgress?.({ phase: 'finalize' });
	const submitJson = await fetchJson('/api/forms/cjc-turn-clean-checklist', {
		method: 'POST',
		body: { ...body, save: false, submission_id: id },
	});
	return submitJson;
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
