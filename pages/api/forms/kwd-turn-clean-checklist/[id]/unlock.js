import { withAuth, isAdmin, verifyAdminPassword } from '../../../../../lib/auth';
import { unlockFormSubmission } from '../../../../../lib/forms/checklistSubmissions';

export default async function handler(req, res) {
	await withAuth(req, res, async (session) => {
		if (req.method !== 'POST') return res.status(405).end();

		if (!isAdmin(session.user)) {
			return res.status(403).json({ error: 'Only admins can unlock a completed checklist.' });
		}

		const { admin_password: adminPassword } = req.body || {};
		const ok = await verifyAdminPassword(adminPassword);
		if (!ok) {
			return res.status(403).json({ error: 'Incorrect admin password.' });
		}

		const submissionId = String(req.query.id || '').trim();
		if (!submissionId) {
			return res.status(400).json({ error: 'Submission id is required' });
		}

		try {
			const submission = await unlockFormSubmission(submissionId);
			return res.json({
				data: {
					id: submission.id,
					status: submission.status,
					locked: false,
				},
			});
		} catch (err) {
			return res.status(err.status || 400).json({ error: err.message || 'Could not unlock checklist' });
		}
	});
}
