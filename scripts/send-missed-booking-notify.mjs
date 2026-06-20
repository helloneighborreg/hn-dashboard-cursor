#!/usr/bin/env node
/**
 * Send booking-change notifications that were missed (e.g. after a late sync fix).
 * Usage: node scripts/send-missed-booking-notify.mjs HM29W9SFTR
 *        npx tsx scripts/send-missed-booking-notify.mjs HM29W9SFTR
 */

import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { notifyTaskBookingChanged } from '../lib/notify.js';
import { withChecklistUrl } from '../lib/checklistUrl.js';
import { enrichTasks } from '../lib/taskEnrich.js';
import { taskBookingChanged } from '../lib/taskSchedule.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const CODE = (process.argv[2] || 'HM29W9SFTR').trim().toUpperCase();

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

/** Reconstruct task row before checkout moved (June 5 → June 6 for HM29W9SFTR). */
function previousTaskFromCurrent(current, { beforeCheckout, beforeDue } = {}) {
	const checkout = beforeCheckout || '2026-06-05';
	const due = beforeDue || checkout;
	return {
		...current,
		checkout_date: checkout,
		due_date: due,
		checkin_date: current.checkin_date || '2026-06-03',
		checkin_time: current.checkin_time || '16:00',
		start_time: current.start_time || '11:00',
	};
}

loadEnv();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
	console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
	process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { data: row, error } = await supabase
	.from('tasks')
	.select('*')
	.eq('reservation_id', CODE)
	.maybeSingle();

if (error) {
	console.error('Supabase error:', error.message);
	process.exit(1);
}
if (!row) {
	console.error(`No task found for reservation_id ${CODE}`);
	process.exit(1);
}

const [enrichedRow] = await enrichTasks([row]);
const current = withChecklistUrl(enrichedRow);
const previous = previousTaskFromCurrent(current);

if (!taskBookingChanged(previous, current)) {
	console.error('No booking diff between previous and current — pass explicit dates or fix task row.');
	console.error('Current checkout:', current.checkout_date);
	process.exit(1);
}

console.log('Sending booking-change notification for:', current.title);
console.log('Assignee:', current.assignee || '(none)');
console.log('Changes: checkout', previous.checkout_date, '→', current.checkout_date);

const result = await notifyTaskBookingChanged(current, previous, current.assignee);
console.log(JSON.stringify(result, null, 2));

const ok = result.email?.emailed || result.admin?.emailed || result.assignee?.texted;
if (result.email?.recipients?.length) {
	console.log('Email To:', result.email.recipients.join(', '));
}
if (!ok) {
	console.error('\nNothing was delivered. Check RESEND_API_KEY, TASK_NOTIFY_FROM_EMAIL, assignee contact, and admin emails.');
	process.exit(1);
}

console.log('\nDone.');
