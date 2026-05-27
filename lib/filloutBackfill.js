import { createClient } from '@supabase/supabase-js';
import { filloutApiConfigured, iterateFilloutSubmissions, resolveFilloutFormIds } from './fillout.js';
import { applyFilloutSubmissionToTask, parseFilloutSubmission } from './filloutTaskUpdate.js';

function getSupabase() {
	const url = process.env.SUPABASE_URL;
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
	return createClient(url, key, { auth: { persistSession: false } });
}

export async function backfillFilloutTasks({ dryRun = false, verbose = true } = {}) {
	if (!filloutApiConfigured()) {
		throw new Error(
			'FILLOUT_API_TOKEN is not set. Add your API key from https://build.fillout.com/home/settings/developer',
		);
	}

	const formIds = await resolveFilloutFormIds();
	const log = verbose ? console.log.bind(console) : () => {};

	const stats = {
		forms: Object.keys(formIds).length,
		submissions_scanned: 0,
		matched: 0,
		updated: 0,
		pdf_added: 0,
		completed: 0,
		skipped: 0,
		unmatched: 0,
		errors: [],
	};

	for (const [formKey, formId] of Object.entries(formIds)) {
		log(`\n→ Form ${formKey} (${formId})`);

		for await (const submission of iterateFilloutSubmissions(formId)) {
			stats.submissions_scanned += 1;
			const parsed = parseFilloutSubmission(submission);
			const label = parsed.reservationId || parsed.taskId || submission.submissionId || '?';

			if (!parsed.taskId && !parsed.reservationId) {
				stats.unmatched += 1;
				if (verbose) log(`  skip ${label}: no task_id / reservation_id`);
				continue;
			}

			stats.matched += 1;

			if (dryRun) {
				log(`  would update ${label} pdf=${parsed.pdfUrl ? 'yes' : 'no'} submission=${parsed.submissionId || '—'}`);
				continue;
			}

			try {
				const result = await applyFilloutSubmissionToTask(submission);
				if (!result.ok) {
					stats.unmatched += 1;
					log(`  ✗ ${label}: ${result.error}`);
					continue;
				}
				if (result.skipped || result.already_completed) {
					stats.skipped += 1;
					continue;
				}
				if (result.updated) {
					stats.updated += 1;
					if (result.task?.checklist_pdf_url) stats.pdf_added += 1;
					if (result.task?.status === 'completed') stats.completed += 1;
					log(`  ✓ ${label} → ${result.task.status}${result.task.checklist_pdf_url ? ' + PDF' : ''}`);
				}
			} catch (err) {
				stats.errors.push({ label, message: err.message });
				log(`  ✗ ${label}: ${err.message}`);
			}
		}
	}

	return stats;
}

/** Summary of completed tasks still missing PDF URLs. */
export async function countTasksMissingPdf() {
	const supabase = getSupabase();
	const { count, error } = await supabase
		.from('tasks')
		.select('*', { count: 'exact', head: true })
		.eq('status', 'completed')
		.is('checklist_pdf_url', null);
	if (error) throw error;
	return count ?? 0;
}
