#!/usr/bin/env node
/**
 * Backfill task completion + PDF links from Fillout form submissions.
 *
 * Usage:
 *   npm run db:backfill-fillout
 *   npm run db:backfill-fillout -- --dry-run
 *
 * Requires FILLOUT_API_TOKEN (https://build.fillout.com/home/settings/developer)
 * and Supabase env vars in env.local / .env.local.
 */

import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadEnv() {
	for (const file of ['env.local', '.env.local', '.env']) {
		const p = path.join(root, file);
		if (!existsSync(p)) continue;
		for (const line of readFileSync(p, 'utf-8').split('\n')) {
			const t = line.trim();
			if (!t || t.startsWith('#')) continue;
			const eq = t.indexOf('=');
			if (eq === -1) continue;
			const key = t.slice(0, eq).trim();
			let val = t.slice(eq + 1).trim();
			if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
				val = val.slice(1, -1);
			}
			if (!process.env[key]) process.env[key] = val;
		}
		break;
	}
}

loadEnv();

const dryRun = process.argv.includes('--dry-run');

const { backfillFilloutTasks, countTasksMissingPdf } = await import('../lib/filloutBackfill.js');

try {
	const missingBefore = await countTasksMissingPdf();
	console.log(`Completed tasks missing PDF before backfill: ${missingBefore}`);
	if (dryRun) console.log('(dry run — no database writes)\n');

	const stats = await backfillFilloutTasks({ dryRun });

	console.log('\n--- Summary ---');
	console.log(`Forms scanned:       ${stats.forms}`);
	console.log(`Submissions scanned: ${stats.submissions_scanned}`);
	console.log(`Matched tasks:       ${stats.matched}`);
	console.log(`Updated:             ${stats.updated}`);
	console.log(`PDFs added:          ${stats.pdf_added}`);
	console.log(`Marked completed:    ${stats.completed}`);
	console.log(`Skipped (no change): ${stats.skipped}`);
	console.log(`Unmatched:           ${stats.unmatched}`);
	if (stats.errors.length) {
		console.log(`Errors:              ${stats.errors.length}`);
	}

	if (!dryRun) {
		const missingAfter = await countTasksMissingPdf();
		console.log(`\nCompleted tasks missing PDF after backfill: ${missingAfter}`);
	}
} catch (err) {
	console.error('Backfill failed:', err.message);
	process.exit(1);
}
