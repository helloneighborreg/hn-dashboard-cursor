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

export async function syncTaskChecklistReviewStatus(submission, status) {
	if (!submission?.task_id || !status) return null;
	const task = await getTaskById(submission.task_id);
	if (!task || task.checklist_review_status === PHOTO_REVIEW_STATUS.APPROVED) {
		return task;
	}
	if (task.checklist_review_status === status) return task;
	return updateTask(task.id, { checklist_review_status: status }, { previousTask: task });
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
