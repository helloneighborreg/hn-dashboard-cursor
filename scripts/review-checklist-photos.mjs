#!/usr/bin/env node
/**
 * Run AI photo review on submitted checklists.
 *
 * Usage:
 *   node scripts/review-checklist-photos.mjs
 *   node scripts/review-checklist-photos.mjs --submission-id=<uuid>
 *   node scripts/review-checklist-photos.mjs --pending --limit=10
 */

import { loadEnvFiles } from './load-env.mjs';
import { createClient } from '@supabase/supabase-js';
import {
	isPhotoReviewConfigured,
	listPendingPhotoReviews,
	PHOTO_REVIEW_STATUS,
	runChecklistPhotoReview,
} from '../lib/forms/checklistPhotoReview.js';

loadEnvFiles();

function fail(message) {
	console.error(`✗ ${message}`);
	process.exit(1);
}

function ok(message) {
	console.log(`✓ ${message}`);
}

function parseArgs(argv) {
	const args = { pending: false, limit: 20, force: false, submissionId: null };
	for (const arg of argv) {
		if (arg === '--pending') args.pending = true;
		else if (arg === '--force') args.force = true;
		else if (arg.startsWith('--limit=')) args.limit = Number(arg.split('=')[1]) || 20;
		else if (arg.startsWith('--submission-id=')) args.submissionId = arg.split('=')[1];
	}
	return args;
}

if (!isPhotoReviewConfigured()) {
	fail('Set CHECKLIST_PHOTO_REVIEW_ENABLED=true and OPENAI_API_KEY in env.local');
}

const args = parseArgs(process.argv.slice(2));
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
	auth: { persistSession: false },
});

let submissionIds = [];
if (args.submissionId) {
	submissionIds = [args.submissionId];
} else if (args.pending) {
	const pending = await listPendingPhotoReviews({ limit: args.limit });
	submissionIds = pending.map((row) => row.id);
	if (!submissionIds.length) {
		ok('No pending submissions to review');
		process.exit(0);
	}
} else {
	const { data, error } = await supabase
		.from('form_submissions')
		.select('id')
		.eq('status', 'submitted')
		.or(`photo_review_status.is.null,photo_review_status.eq.${PHOTO_REVIEW_STATUS.PENDING},photo_review_status.eq.${PHOTO_REVIEW_STATUS.ERROR}`)
		.order('submitted_at', { ascending: true })
		.limit(args.limit);
	if (error) fail(error.message);
	submissionIds = (data || []).map((row) => row.id);
	if (!submissionIds.length) {
		ok('No submissions need review');
		process.exit(0);
	}
}

let reviewed = 0;
let flagged = 0;
for (const submissionId of submissionIds) {
	try {
		const result = await runChecklistPhotoReview(submissionId, { force: args.force });
		reviewed += 1;
		if (result.status === PHOTO_REVIEW_STATUS.NEEDS_REVIEW) flagged += 1;
		ok(`${submissionId} → ${result.status}${result.flagged_count ? ` (${result.flagged_count} flagged)` : ''}`);
	} catch (err) {
		console.error(`✗ ${submissionId}: ${err.message}`);
	}
}

console.log(`\nReviewed ${reviewed} submission(s); ${flagged} need manual review.`);
