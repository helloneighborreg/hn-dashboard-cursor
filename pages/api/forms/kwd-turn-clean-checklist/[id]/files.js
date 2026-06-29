import { withAuth } from '../../../../../lib/auth';
import { uploadChecklistFile } from '../../../../../lib/forms/checklistFormStorage';
import { appendSubmissionFile } from '../../../../../lib/forms/checklistSubmissions';
import { CHECKLIST_API_BODY_PARSER } from '../../../../../lib/forms/createChecklistApiHandler';

export const config = CHECKLIST_API_BODY_PARSER;

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		if (req.method !== 'POST') return res.status(405).end();

		const submissionId = String(req.query.id || '').trim();
		if (!submissionId) {
			return res.status(400).json({ error: 'Submission id is required' });
		}

		const {
			questionId,
			base64,
			contentType,
			filename,
			capturedAt = null,
			captureSource = null,
			facingMode = null,
			imageWidth = null,
			imageHeight = null,
		} = req.body || {};

		if (!questionId || !base64 || !contentType) {
			return res.status(400).json({ error: 'questionId, base64, and contentType are required' });
		}
		if (captureSource && captureSource !== 'camera') {
			return res.status(400).json({ error: 'Photos must be taken live with the device camera.' });
		}

		try {
			const uploaded = await uploadChecklistFile({
				base64,
				contentType,
				filename,
				submissionId,
				questionId,
				capturedAt,
				captureSource,
				facingMode,
				imageWidth,
				imageHeight,
			});
			const record = await appendSubmissionFile(submissionId, questionId, uploaded);
			return res.status(201).json({
				data: {
					id: record.id,
					file: {
						question_id: questionId,
						storage_path: uploaded.storage_path,
						url: uploaded.url,
						filename: uploaded.filename,
						content_type: uploaded.content_type,
						captured_at: uploaded.captured_at || null,
					},
				},
			});
		} catch (err) {
			console.error('KWD checklist file upload error:', err.message);
			const message = err?.message || 'Upload failed';
			if (/bucket not found|Bucket not found/i.test(message)) {
				return res.status(500).json({
					error: 'Storage bucket missing. Run supabase/migrations/20260625_form_submissions.sql in Supabase.',
				});
			}
			return res.status(err.status || 400).json({ error: message });
		}
	});
}
