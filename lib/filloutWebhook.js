/**
 * Parse Fillout webhook / submission payloads into task completion fields.
 * Fillout sends nested JSON (submission.urlParameters, submission.questions, …).
 */

const TASK_ID_KEYS = new Set(['task_id', 'taskid', 'task']);
const RESERVATION_ID_KEYS = new Set(['reservation_id', 'reservationid', 'reservation', 'booking_code', 'bookingcode']);
const PDF_KEYS = new Set(['pdfurl', 'pdf_url', 'pdf', 'checklist_pdf_url', 'document_url', 'documenturl']);
const SUBMISSION_ID_KEYS = new Set(['submissionid', 'submission_id', 'id']);

function normalizeKey(key) {
	return String(key || '')
		.trim()
		.toLowerCase()
		.replace(/[\s-]+/g, '_');
}

function isNonEmpty(value) {
	return value != null && String(value).trim() !== '';
}

function asString(value) {
	if (!isNonEmpty(value)) return null;
	if (typeof value === 'object') {
		if (isNonEmpty(value.url)) return String(value.url).trim();
		if (isNonEmpty(value.href)) return String(value.href).trim();
		if (isNonEmpty(value.link)) return String(value.link).trim();
		return null;
	}
	return String(value).trim();
}

function assignTarget(target, key, value) {
	const normalized = normalizeKey(key);
	const str = asString(value);
	if (!str) return;

	if (TASK_ID_KEYS.has(normalized) && !target.taskId) target.taskId = str;
	else if (RESERVATION_ID_KEYS.has(normalized) && !target.reservationId) target.reservationId = str;
	else if (PDF_KEYS.has(normalized) && !target.pdfUrl) target.pdfUrl = str;
	else if (SUBMISSION_ID_KEYS.has(normalized) && !target.submissionId) target.submissionId = str;
}

function walk(node, target, depth = 0) {
	if (node == null || depth > 8) return;

	if (Array.isArray(node)) {
		for (const item of node) walk(item, target, depth + 1);
		return;
	}

	if (typeof node !== 'object') return;

	if ('name' in node || 'id' in node) {
		const key = node.name ?? node.id ?? node.key ?? node.label;
		assignTarget(target, key, node.value ?? node.answer ?? node.text ?? node.content);
	}

	for (const [key, value] of Object.entries(node)) {
		if (key === 'questions' || key === 'urlParameters' || key === 'fields' || key === 'documents') {
			walk(value, target, depth + 1);
			continue;
		}
		if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
			assignTarget(target, key, value);
		} else if (typeof value === 'object') {
			walk(value, target, depth + 1);
		}
	}
}

function pickFlat(body, ...keys) {
	for (const key of keys) {
		const v = body?.[key];
		if (isNonEmpty(v)) return String(v).trim();
	}
	return null;
}

function extractDocumentUrl(documents) {
	if (!Array.isArray(documents)) return null;
	for (const doc of documents) {
		const url = asString(doc?.url)
			|| asString(doc?.downloadUrl)
			|| asString(doc?.download_url)
			|| asString(doc?.fileUrl)
			|| asString(doc?.file_url)
			|| asString(doc?.link)
			|| asString(doc?.href);
		if (url) return url;
	}
	return null;
}

function extractPdfFromQuestions(questions) {
	if (!Array.isArray(questions)) return null;
	for (const q of questions) {
		const name = normalizeKey(q?.name || q?.id || q?.label);
		const type = normalizeKey(q?.type);
		const value = q?.value ?? q?.answer ?? q?.text;

		if (PDF_KEYS.has(name) || type.includes('document') || type.includes('file')) {
			const url = asString(value);
			if (url) return url;
		}

		if (value && typeof value === 'object') {
			const url = asString(value.url)
				|| asString(value.downloadUrl)
				|| asString(value.fileUrl)
				|| asString(value.link);
			if (url && (PDF_KEYS.has(name) || /\.pdf(\?|$)/i.test(url))) return url;
		}
	}
	return null;
}

/** @returns {{ taskId: string|null, reservationId: string|null, submissionId: string|null, pdfUrl: string|null }} */
export function parseFilloutWebhookPayload(body) {
	const target = {
		taskId: null,
		reservationId: null,
		submissionId: null,
		pdfUrl: null,
	};

	if (!body || typeof body !== 'object') return target;

	const submission = body.submission || body.data?.submission || body.data || body.submissionData;

	// Common flat / custom webhook body fields
	target.taskId = pickFlat(body, 'task_id', 'taskId') || pickFlat(submission, 'task_id', 'taskId');
	target.reservationId =
		pickFlat(body, 'reservation_id', 'reservationId')
		|| pickFlat(submission, 'reservation_id', 'reservationId');
	target.submissionId =
		pickFlat(body, 'submissionId', 'submission_id')
		|| pickFlat(submission, 'submissionId', 'submission_id', 'id');
	target.pdfUrl =
		pickFlat(body, 'pdfUrl', 'pdf_url', 'pdf')
		|| pickFlat(submission, 'pdfUrl', 'pdf_url', 'pdf');

	if (submission?.submissionId && !target.submissionId) {
		target.submissionId = String(submission.submissionId).trim();
	}

	if (!target.pdfUrl) {
		target.pdfUrl =
			extractDocumentUrl(submission?.documents)
			|| extractDocumentUrl(body.documents)
			|| extractPdfFromQuestions(submission?.questions)
			|| extractPdfFromQuestions(body.questions);
	}

	walk(body, target);
	walk(submission, target);

	return target;
}

export function buildCompletionNotes(existingNotes, { submissionId, pdfUrl }) {
	const lines = [];
	if (existingNotes?.trim()) lines.push(existingNotes.trim());

	if (submissionId) {
		const line = `Fillout submission: ${submissionId}`;
		if (!lines.some((l) => l.includes(submissionId))) lines.push(line);
	}
	if (pdfUrl) {
		const line = `Checklist PDF: ${pdfUrl}`;
		if (!lines.some((l) => l.includes(pdfUrl))) lines.push(line);
	}

	return lines.join('\n') || null;
}
