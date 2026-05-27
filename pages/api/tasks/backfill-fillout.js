import { withAuth } from '../../../lib/auth';
import { backfillFilloutTasks, countTasksMissingPdf } from '../../../lib/filloutBackfill.js';
import { filloutApiConfigured } from '../../../lib/fillout.js';

export default async function handler(req, res) {
	if (req.method !== 'POST') return res.status(405).end();

	await withAuth(req, res, async () => {
		if (!filloutApiConfigured()) {
			return res.status(503).json({
				error: 'FILLOUT_API_TOKEN is not configured',
				hint: 'Add your API key from https://build.fillout.com/home/settings/developer',
			});
		}

		const dryRun = req.query.dry_run === 'true';

		try {
			const missingBefore = await countTasksMissingPdf();
			const stats = await backfillFilloutTasks({ dryRun, verbose: false });
			const missingAfter = dryRun ? missingBefore : await countTasksMissingPdf();

			return res.json({
				ok: true,
				dry_run: dryRun,
				missing_pdf_before: missingBefore,
				missing_pdf_after: missingAfter,
				...stats,
			});
		} catch (err) {
			console.error('Fillout backfill failed:', err.message);
			return res.status(500).json({ error: err.message });
		}
	}, { adminOnly: true });
}
