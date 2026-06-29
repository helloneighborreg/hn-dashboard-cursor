import { withAuth, isAdmin } from '../../../../../lib/auth';
import { getFormSubmissionById } from '../../../../../lib/forms/checklistSubmissions';
import {
	approveChecklistPhotoReview,
	PHOTO_REVIEW_STATUS,
} from '../../../../../lib/forms/checklistPhotoReview';

function isUuid(value) {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
}

export default async function handler(req, res) {
	await withAuth(req, res, async (session) => {
		if (!isAdmin(session.user)) {
			return res.status(403).json({ error: 'Forbidden' });
		}

		const submissionId = String(req.query.id || '').trim();
		if (!isUuid(submissionId)) {
			return res.status(400).json({ error: 'Invalid submission id' });
		}

		if (req.method === 'GET') {
			const submission = await getFormSubmissionById(submissionId);
			if (!submission) return res.status(404).json({ error: 'Checklist not found' });

			return res.json({
				data: {
					id: submission.id,
					task_id: submission.task_id,
					photo_review_status: submission.photo_review_status || null,
					photo_review_results: submission.photo_review_results || [],
					photo_reviewed_at: submission.photo_reviewed_at || null,
				},
			});
		}

		if (req.method === 'POST') {
			const action = String(req.body?.action || 'approve').trim();
			if (action !== 'approve') {
				return res.status(400).json({ error: 'Only action=approve is supported' });
			}

			const task = await approveChecklistPhotoReview(submissionId);
			return res.json({
				data: {
					id: submissionId,
					photo_review_status: PHOTO_REVIEW_STATUS.APPROVED,
					task_id: task?.id || null,
					checklist_review_status: task?.checklist_review_status || PHOTO_REVIEW_STATUS.APPROVED,
				},
			});
		}

		res.status(405).end();
	});
}
