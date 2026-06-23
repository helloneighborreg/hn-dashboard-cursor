import { withAuth } from '../../../../../lib/auth';
import { uploadChecklistFile } from '../../../../../lib/forms/checklistFormStorage';
import { appendSubmissionFile } from '../../../../../lib/forms/checklistSubmissions';

export const config = {
	api: {
		bodyParser: {
			sizeLimit: '14mb',
		},
	},
};

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
			return res.status(201).json({ data: { id: record.id } });
		} catch (err) {
			console.error('CJC checklist file upload error:', err.message);
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
