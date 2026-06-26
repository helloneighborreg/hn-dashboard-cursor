import { fetchWithTimeout } from '../httpFetch.js';
import { getSupabase } from '../supabase.js';
import {
	buildChecklistSections,
	getQuestion,
	HEADER_QUESTION_IDS,
} from './cjcTurnCleanChecklist.js';
import { getChecklistUploadPublicUrl } from './checklistFormStorage.js';
import { getSectionExamplesByForm } from './checklistSectionExamples.js';
import { CJC_TURN_CLEAN_FORM_SLUG } from './cjcTurnCleanChecklist.js';
import { getFormSubmissionById, updateFormSubmission } from './checklistSubmissions.js';
import { getTaskById, updateTask } from '../db.js';

export const PHOTO_REVIEW_STATUS = {
	PENDING: 'pending',
	PASSED: 'passed',
	NEEDS_REVIEW: 'needs_review',
	APPROVED: 'approved',
	SKIPPED: 'skipped',
	ERROR: 'error',
};

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_CONFIDENCE = 0.65;
const DEFAULT_CONCURRENCY = 4;
const REVIEW_TIMEOUT_MS = 45000;

function reviewEnabled() {
	return String(process.env.CHECKLIST_PHOTO_REVIEW_ENABLED || '').toLowerCase() === 'true';
}

function openAiConfigured() {
	return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function confidenceThreshold() {
	const raw = Number(process.env.CHECKLIST_PHOTO_REVIEW_CONFIDENCE);
	return Number.isFinite(raw) && raw > 0 && raw <= 1 ? raw : DEFAULT_CONFIDENCE;
}

function reviewModel() {
	return (process.env.CHECKLIST_PHOTO_REVIEW_MODEL || DEFAULT_MODEL).trim();
}

function reviewConcurrency() {
	const raw = Number(process.env.CHECKLIST_PHOTO_REVIEW_CONCURRENCY);
	return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 8) : DEFAULT_CONCURRENCY;
}

function imageUrlForFile(file) {
	return file?.url || file?.public_url || getChecklistUploadPublicUrl(file?.storage_path) || null;
}

function sectionTitleFromQuestion(questionId) {
	const question = getQuestion(questionId);
	if (!question) return questionId;
	return String(question.name || '')
		.replace(/\s*-\s*(Task List|Checklist|Photo Upload)\s*$/i, '')
		.trim();
}

/** Build review targets from stored submission answers. */
export function buildPhotoReviewTargets(answers) {
	const targets = [];
	const seen = new Set();

	for (const section of buildChecklistSections()) {
		if (!section.photo) continue;
		const answer = answers?.[section.photo.id];
		const files = answer?.files || [];
		const exampleSectionId = section.checklist?.id || section.id;
		const expectedArea = section.title || sectionTitleFromQuestion(section.photo.id);

		for (let index = 0; index < files.length; index += 1) {
			const file = files[index];
			const imageUrl = imageUrlForFile(file);
			if (!imageUrl) continue;
			const key = `${section.photo.id}:${imageUrl}`;
			if (seen.has(key)) continue;
			seen.add(key);

			targets.push({
				questionId: section.photo.id,
				sectionId: exampleSectionId,
				expectedArea,
				imageUrl,
				filename: file.filename || null,
				fileIndex: index,
			});
		}
	}

	for (const questionId of HEADER_QUESTION_IDS) {
		const question = getQuestion(questionId);
		if (!question || question.type !== 'FileUpload') continue;
		const answer = answers?.[questionId];
		const files = answer?.files || [];
		const expectedArea = sectionTitleFromQuestion(questionId) || question.name;

		for (let index = 0; index < files.length; index += 1) {
			const file = files[index];
			const imageUrl = imageUrlForFile(file);
			if (!imageUrl) continue;
			const key = `${questionId}:${imageUrl}`;
			if (seen.has(key)) continue;
			seen.add(key);

			targets.push({
				questionId,
				sectionId: questionId,
				expectedArea,
				imageUrl,
				filename: file.filename || null,
				fileIndex: index,
			});
		}
	}

	return targets;
}

function buildReviewPrompt(expectedArea, propertyCode) {
	const propertyLine = propertyCode ? `Property: ${propertyCode}.` : '';
	return [
		'You review turnover-cleaning checklist photos for a short-term rental.',
		propertyLine,
		`Expected area: "${expectedArea}".`,
		'Decide whether the submitted photo clearly shows that area (not a different room, fixture, or unrelated subject).',
		'If unsure, set match to false.',
		'Respond with JSON only:',
		'{"match":true|false,"confidence":0.0-1.0,"detected_area":"brief label","reason":"one short sentence"}',
	].filter(Boolean).join('\n');
}

function parseReviewJson(content) {
	const text = String(content || '').trim();
	if (!text) throw new Error('Empty model response');
	try {
		return JSON.parse(text);
	} catch {
		const start = text.indexOf('{');
		const end = text.lastIndexOf('}');
		if (start >= 0 && end > start) {
			return JSON.parse(text.slice(start, end + 1));
		}
		throw new Error('Could not parse model JSON');
	}
}

function normalizePhotoResult(target, modelResult, { referenceImageUrl = null } = {}) {
	const confidence = Number(modelResult?.confidence);
	const safeConfidence = Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0;
	const match = modelResult?.match === true;
	const threshold = confidenceThreshold();
	const flagged = !match || safeConfidence < threshold;

	return {
		question_id: target.questionId,
		section_id: target.sectionId,
		expected_area: target.expectedArea,
		image_url: target.imageUrl,
		filename: target.filename,
		file_index: target.fileIndex,
		reference_image_url: referenceImageUrl,
		match,
		confidence: safeConfidence,
		flagged,
		detected_area: String(modelResult?.detected_area || '').trim() || null,
		reason: String(modelResult?.reason || '').trim() || null,
	};
}

export async function reviewChecklistPhoto(target, { referenceImageUrl = null, propertyCode = null } = {}) {
	if (!openAiConfigured()) {
		throw new Error('OPENAI_API_KEY is not configured');
	}

	const content = [
		{ type: 'text', text: buildReviewPrompt(target.expectedArea, propertyCode) },
		{ type: 'image_url', image_url: { url: target.imageUrl, detail: 'low' } },
	];

	if (referenceImageUrl) {
		content.push({ type: 'text', text: 'Reference photo of the correct area:' });
		content.push({ type: 'image_url', image_url: { url: referenceImageUrl, detail: 'low' } });
	}

	const res = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: reviewModel(),
			temperature: 0.1,
			max_tokens: 200,
			response_format: { type: 'json_object' },
			messages: [{ role: 'user', content }],
		}),
	}, REVIEW_TIMEOUT_MS);

	const json = await res.json().catch(() => ({}));
	if (!res.ok) {
		const message = json?.error?.message || `OpenAI request failed (${res.status})`;
		throw new Error(message);
	}

	const parsed = parseReviewJson(json?.choices?.[0]?.message?.content);
	return normalizePhotoResult(target, parsed, { referenceImageUrl });
}

async function mapWithConcurrency(items, concurrency, mapper) {
	if (!items.length) return [];
	const results = new Array(items.length);
	let nextIndex = 0;

	async function worker() {
		while (nextIndex < items.length) {
			const current = nextIndex;
			nextIndex += 1;
			results[current] = await mapper(items[current], current);
		}
	}

	const workers = Array.from(
		{ length: Math.min(concurrency, items.length) },
		() => worker(),
	);
	await Promise.all(workers);
	return results;
}

function summarizePhotoResults(results) {
	if (!results.length) return PHOTO_REVIEW_STATUS.SKIPPED;
	const flagged = results.filter((row) => row.flagged);
	if (flagged.length) return PHOTO_REVIEW_STATUS.NEEDS_REVIEW;
	return PHOTO_REVIEW_STATUS.PASSED;
}

export async function syncTaskChecklistReviewStatus(submission, status) {
	if (!submission?.task_id || !status) return null;
	const task = await getTaskById(submission.task_id);
	if (!task || task.checklist_review_status === PHOTO_REVIEW_STATUS.APPROVED) {
		return task;
	}
	if (task.checklist_review_status === status) return task;
	return updateTask(task.id, { checklist_review_status: status }, { previousTask: task });
}

export async function runChecklistPhotoReview(submissionId, { force = false } = {}) {
	if (!reviewEnabled()) {
		return { ok: true, skipped: true, reason: 'disabled' };
	}
	if (!openAiConfigured()) {
		return { ok: false, skipped: true, reason: 'openai_not_configured' };
	}

	const submission = await getFormSubmissionById(submissionId);
	if (!submission) {
		const err = new Error('Checklist not found');
		err.status = 404;
		throw err;
	}

	if (!force && submission.photo_review_status === PHOTO_REVIEW_STATUS.APPROVED) {
		return {
			ok: true,
			skipped: true,
			reason: 'already_approved',
			status: submission.photo_review_status,
			results: submission.photo_review_results || [],
		};
	}

	const targets = buildPhotoReviewTargets(submission.answers);
	if (!targets.length) {
		const status = PHOTO_REVIEW_STATUS.SKIPPED;
		await updateFormSubmission(submissionId, {
			photo_review_status: status,
			photo_review_results: [],
			photo_reviewed_at: new Date().toISOString(),
		});
		await syncTaskChecklistReviewStatus(submission, status);
		return { ok: true, status, results: [], skipped: true, reason: 'no_photos' };
	}

	await updateFormSubmission(submissionId, {
		photo_review_status: PHOTO_REVIEW_STATUS.PENDING,
	});

	let examplesBySection = {};
	try {
		examplesBySection = await getSectionExamplesByForm(submission.form_slug || CJC_TURN_CLEAN_FORM_SLUG);
	} catch (err) {
		console.warn('Checklist photo review: could not load example photos:', err.message);
	}

	const propertyCode = submission.property_code || submission.answers?.['jXsd']?.value || null;
	const results = await mapWithConcurrency(targets, reviewConcurrency(), async (target) => {
		const referenceImageUrl = examplesBySection[target.sectionId]?.[0]?.url || null;
		try {
			return await reviewChecklistPhoto(target, { referenceImageUrl, propertyCode });
		} catch (err) {
			return {
				question_id: target.questionId,
				section_id: target.sectionId,
				expected_area: target.expectedArea,
				image_url: target.imageUrl,
				filename: target.filename,
				file_index: target.fileIndex,
				reference_image_url: referenceImageUrl,
				match: false,
				confidence: 0,
				flagged: true,
				detected_area: null,
				reason: err.message || 'Review failed',
				error: true,
			};
		}
	});

	const status = summarizePhotoResults(results);
	const reviewedAt = new Date().toISOString();
	await updateFormSubmission(submissionId, {
		photo_review_status: status,
		photo_review_results: results,
		photo_reviewed_at: reviewedAt,
	});

	const freshSubmission = await getFormSubmissionById(submissionId);
	const task = await syncTaskChecklistReviewStatus(freshSubmission, status);

	if (status === PHOTO_REVIEW_STATUS.NEEDS_REVIEW) {
		try {
			const { notifyChecklistNeedsReview } = await import('../notify.js');
			await notifyChecklistNeedsReview(freshSubmission, { results, task });
		} catch (err) {
			console.error('Checklist review notify failed:', err.message);
		}
	}

	return {
		ok: true,
		status,
		results,
		reviewed_at: reviewedAt,
		task_id: task?.id || submission.task_id || null,
		flagged_count: results.filter((row) => row.flagged).length,
	};
}

/** Fire-and-forget helper after checklist submit (best effort on serverless). */
export function queueChecklistPhotoReview(submissionId) {
	if (!reviewEnabled() || !openAiConfigured()) return Promise.resolve({ skipped: true });
	return runChecklistPhotoReview(submissionId).catch((err) => {
		console.error('Checklist photo review failed:', err.message);
		return updateFormSubmission(submissionId, {
			photo_review_status: PHOTO_REVIEW_STATUS.ERROR,
			photo_reviewed_at: new Date().toISOString(),
		}).catch(() => null);
	});
}

export async function approveChecklistPhotoReview(submissionId) {
	const submission = await getFormSubmissionById(submissionId);
	if (!submission) {
		const err = new Error('Checklist not found');
		err.status = 404;
		throw err;
	}

	await updateFormSubmission(submissionId, {
		photo_review_status: PHOTO_REVIEW_STATUS.APPROVED,
		photo_reviewed_at: new Date().toISOString(),
	});
	return syncTaskChecklistReviewStatus(submission, PHOTO_REVIEW_STATUS.APPROVED);
}

export async function listPendingPhotoReviews({ limit = 20 } = {}) {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('form_submissions')
		.select('id, task_id, property_code, cleaner_name, submitted_at, photo_review_status')
		.eq('status', 'submitted')
		.or(`photo_review_status.is.null,photo_review_status.eq.${PHOTO_REVIEW_STATUS.PENDING}`)
		.order('submitted_at', { ascending: true })
		.limit(limit);
	if (error) throw error;
	return data || [];
}

export function isPhotoReviewConfigured() {
	return reviewEnabled() && openAiConfigured();
}
