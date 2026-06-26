import { withAuth, isAdmin } from '../../../../lib/auth';
import { validateChecklistGeofence } from '../../../../lib/geofence';
import { applyChecklistSubmissionToTask, markTaskChecklistStarted } from '../../../../lib/checklistTaskUpdate';
import { queueChecklistPhotoReview } from '../../../../lib/forms/checklistPhotoReview';
import { uploadChecklistFile } from '../../../../lib/forms/checklistFormStorage';
import {
	buildSubmissionViewUrl,
	FORM_SUBMISSION_STATUS,
	getFormSubmissionById,
	getFormSubmissionForTask,
	insertFormSubmissionFiles,
	isSubmissionLocked,
	saveFormSubmissionDraft,
	submitFormSubmission,
	unlockFormSubmission,
	updateFormSubmissionAnswers,
} from '../../../../lib/forms/checklistSubmissions';

export const config = {
	api: {
		bodyParser: {
			// Dozens of room photos per checklist; match task attachment uploads.
			sizeLimit: '14mb',
		},
	},
};

/** Expected validation / state errors — no server log noise in dev. */
function isExpectedChecklistClientError(err) {
	const status = err?.status;
	return status >= 400 && status < 500;
}

function isUuid(value) {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
}

async function uploadNewFiles(submissionId, fileUploads) {
	const stored = [];
	for (const file of fileUploads || []) {
		if (!file?.base64) continue;
		const uploaded = await uploadChecklistFile({
			base64: file.base64,
			contentType: file.contentType,
			filename: file.filename,
			submissionId,
			questionId: file.questionId,
			capturedAt: file.capturedAt,
			captureSource: file.captureSource,
			facingMode: file.facingMode,
			imageWidth: file.imageWidth,
			imageHeight: file.imageHeight,
		});
		stored.push({
			question_id: file.questionId,
			...uploaded,
		});
	}
	return stored;
}

function sanitizeAnswersForStorage(answers) {
	const clean = {};
	for (const [questionId, answer] of Object.entries(answers || {})) {
		if (answer?.type === 'FileUpload') {
			clean[questionId] = {
				...answer,
				files: (answer.files || []).filter((file) => !file?.base64),
			};
			continue;
		}
		clean[questionId] = answer;
	}
	return clean;
}

function mergeUploadedFilesIntoAnswers(answers, storedFiles) {
	const byQuestion = {};
	for (const file of storedFiles) {
		if (!byQuestion[file.question_id]) byQuestion[file.question_id] = [];
		byQuestion[file.question_id].push({
			storage_path: file.storage_path,
			url: file.url,
			filename: file.filename,
			content_type: file.content_type,
			captured_at: file.captured_at || null,
			capture_source: file.capture_source || null,
			facing_mode: file.facing_mode || null,
			image_width: file.image_width ?? null,
			image_height: file.image_height ?? null,
		});
	}

	const merged = { ...answers };
	for (const [questionId, files] of Object.entries(byQuestion)) {
		const existing = merged[questionId]?.files || [];
		merged[questionId] = {
			...(merged[questionId] || { type: 'FileUpload', name: questionId, files: [] }),
			files: [...existing, ...files],
		};
	}
	return merged;
}

function collectFileUploads(answers) {
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

async function persistSubmission({
	answers,
	fileUploads,
	submissionId,
	taskId,
	reservationId,
	propertyCode,
	guestName,
	cleanerName,
	submittedBy,
	save = false,
}) {
	const sanitized = sanitizeAnswersForStorage(answers);
	const record = save
		? await saveFormSubmissionDraft({
			submissionId,
			answers: sanitized,
			taskId,
			reservationId,
			propertyCode,
			guestName,
			cleanerName,
			submittedBy,
		})
		: await submitFormSubmission({
			submissionId,
			answers: sanitized,
			taskId,
			reservationId,
			propertyCode,
			guestName,
			cleanerName,
			submittedBy,
		});

	const storedFiles = await uploadNewFiles(record.id, fileUploads);
	if (storedFiles.length) {
		const mergedAnswers = mergeUploadedFilesIntoAnswers(sanitized, storedFiles);
		await insertFormSubmissionFiles(record.id, storedFiles);
		await updateFormSubmissionAnswers(record.id, mergedAnswers);
		return {
			...record,
			answers: mergedAnswers,
			view_url: buildSubmissionViewUrl(record.id),
		};
	}

	const fresh = await getFormSubmissionById(record.id);
	return {
		...record,
		answers: fresh?.answers || sanitized,
		view_url: buildSubmissionViewUrl(record.id),
	};
}

export default async function handler(req, res) {
	await withAuth(req, res, async (session) => {
		if (req.method === 'GET') {
			const submissionId = String(req.query.submission_id || '').trim();
			const taskId = String(req.query.task_id || req.query.id || req.query.TaskID || '').trim();
			let submission = null;

			if (isUuid(submissionId)) {
				submission = await getFormSubmissionById(submissionId);
			} else if (isUuid(taskId)) {
				submission = await getFormSubmissionForTask(taskId);
			}

			if (!submission) {
				return res.status(404).json({ error: 'Checklist not found' });
			}

			return res.json({
				data: {
					id: submission.id,
					status: submission.status || FORM_SUBMISSION_STATUS.SUBMITTED,
					answers: submission.answers,
					task_id: submission.task_id,
					view_url: buildSubmissionViewUrl(submission.id),
					submitted_at: submission.submitted_at,
					locked: isSubmissionLocked(submission),
				},
			});
		}

		if (req.method === 'POST') {
			const {
				answers,
				fileUploads: bodyFileUploads = [],
				submission_id: submissionId,
				save = false,
				task_id: taskId,
				reservation_id: reservationId,
				property_code: propertyCode,
				guest_name: guestName,
				cleaner_name: cleanerName,
				location = null,
			} = req.body || {};

			if (!answers || typeof answers !== 'object') {
				return res.status(400).json({ error: 'answers are required' });
			}

			if (!isAdmin(session.user) && !save) {
				const geo = validateChecklistGeofence({
					latitude: location?.latitude,
					longitude: location?.longitude,
					propertyCode: propertyCode || answers?.['jXsd']?.value,
				});
				if (!geo.ok && !geo.skipped) {
					return res.status(403).json({
						error: geo.error,
						geofence: {
							distanceM: geo.distanceM ?? null,
							radiusM: geo.radiusM ?? null,
						},
					});
				}
			}

			const fileUploads = bodyFileUploads.length ? bodyFileUploads : collectFileUploads(answers);
			for (const file of fileUploads) {
				if (file.captureSource && file.captureSource !== 'camera') {
					return res.status(400).json({ error: 'Photos must be taken live with the device camera.' });
				}
			}

			try {
				const resolvedTaskId = isUuid(taskId)
					? taskId
					: (isUuid(answers?.['nqZp']?.value) ? answers['nqZp'].value : null);

				const record = await persistSubmission({
					answers,
					fileUploads,
					submissionId: isUuid(submissionId) ? submissionId : null,
					taskId: resolvedTaskId,
					reservationId: reservationId || answers?.['cdyd']?.value || null,
					propertyCode: propertyCode || null,
					guestName: guestName || null,
					cleanerName: cleanerName || null,
					submittedBy: session.user?.username || session.user?.name || null,
					save: Boolean(save),
				});

				let taskLink = null;
				if (!save) {
					try {
						taskLink = await applyChecklistSubmissionToTask({
							submissionId: record.id,
							taskId: record.task_id || resolvedTaskId,
							reservationId: record.reservation_id || reservationId || answers?.['cdyd']?.value || null,
						});
					} catch (err) {
						console.error('Checklist task link failed:', err.message);
					}
					queueChecklistPhotoReview(record.id);
				} else {
					const draftTaskId = record.task_id || resolvedTaskId;
					if (draftTaskId) {
						try {
							await markTaskChecklistStarted(draftTaskId);
						} catch (err) {
							console.error('Checklist started timestamp failed:', err.message);
						}
					}
				}

				return res.status(save ? 200 : 201).json({
					data: {
						id: record.id,
						view_url: record.view_url,
						status: record.status,
						submitted_at: record.submitted_at,
						locked: isSubmissionLocked(record),
						task_completion_skipped: taskLink?.completionSkipped ? 'future_checkout' : undefined,
					},
				});
			} catch (err) {
				if (!isExpectedChecklistClientError(err)) {
					console.error('CJC checklist submit error:', err.message);
				}
				const message = err?.message || 'Submission failed';
				if (/form_submissions|form_submission_files/i.test(message) && /does not exist|PGRST205/i.test(message)) {
					return res.status(500).json({
						error: 'Database tables missing. Run supabase/migrations/20260625_form_submissions.sql in Supabase.',
					});
				}
				if (/bucket not found|Bucket not found/i.test(message)) {
					return res.status(500).json({
						error: 'Storage bucket missing. Run supabase/migrations/20260625_form_submissions.sql in Supabase.',
					});
				}
				return res.status(err.status || 400).json({ error: message });
			}
		}

		res.status(405).end();
	});
}
