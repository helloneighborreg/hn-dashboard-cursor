import { withAuth, isAdmin } from '../../../../lib/auth';
import {
	CJC_TURN_CLEAN_FORM_SLUG,
} from '../../../../lib/forms/cjcTurnCleanChecklist';
import {
	deleteSectionExample,
	getSectionExamplesByForm,
	uploadSectionExample,
} from '../../../../lib/forms/checklistSectionExamples';

export const config = {
	api: {
		bodyParser: {
			sizeLimit: '14mb',
		},
	},
};

export default async function handler(req, res) {
	await withAuth(req, res, async (session) => {
		if (req.method === 'GET') {
			try {
				const examples = await getSectionExamplesByForm(CJC_TURN_CLEAN_FORM_SLUG);
				return res.json({ data: examples });
			} catch (err) {
				const message = err?.message || 'Could not load example photos';
				if (/form_checklist_section_examples/i.test(message) && /does not exist|PGRST205/i.test(message)) {
					return res.status(500).json({
						error: 'Example photos table missing. Run supabase/migrations/20260630_checklist_section_examples.sql in Supabase.',
					});
				}
				console.error('Checklist examples GET error:', message);
				return res.status(500).json({ error: message });
			}
		}

		if (!isAdmin(session.user)) {
			return res.status(403).json({ error: 'Admin access required' });
		}

		if (req.method === 'POST') {
			const { section_id: sectionId, base64, contentType, filename } = req.body || {};
			if (!sectionId || !base64 || !contentType) {
				return res.status(400).json({ error: 'section_id, base64, and contentType are required' });
			}

			try {
				const photo = await uploadSectionExample({
					formSlug: CJC_TURN_CLEAN_FORM_SLUG,
					sectionId: String(sectionId).trim(),
					base64,
					contentType,
					filename,
				});
				return res.status(201).json({ data: photo });
			} catch (err) {
				const message = err?.message || 'Upload failed';
				if (/form_checklist_section_examples/i.test(message) && /does not exist|PGRST205/i.test(message)) {
					return res.status(500).json({
						error: 'Example photos table missing. Run supabase/migrations/20260630_checklist_section_examples.sql in Supabase.',
					});
				}
				if (/bucket not found|Bucket not found/i.test(message)) {
					return res.status(500).json({
						error: 'Storage bucket missing. Run supabase/migrations/20260625_form_submissions.sql in Supabase.',
					});
				}
				console.error('Checklist examples POST error:', message);
				return res.status(err.status || 400).json({ error: message });
			}
		}

		if (req.method === 'DELETE') {
			const { id } = req.body || {};
			if (!id) return res.status(400).json({ error: 'id is required' });

			try {
				await deleteSectionExample({ id, formSlug: CJC_TURN_CLEAN_FORM_SLUG });
				return res.json({ ok: true });
			} catch (err) {
				const message = err?.message || 'Delete failed';
				console.error('Checklist examples DELETE error:', message);
				return res.status(err.status || 400).json({ error: message });
			}
		}

		res.status(405).end();
	});
}
