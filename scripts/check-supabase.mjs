#!/usr/bin/env node
/**
 * Verify Supabase env + that tasks/expenses tables exist.
 * Usage: npm run db:check
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnvFiles } from './load-env.mjs';

loadEnvFiles();

const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
	console.error('✗ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.local');
	process.exit(1);
}
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
	console.error('✗ Invalid SUPABASE_URL — use https://YOUR-PROJECT.supabase.co from Settings → API');
	process.exit(1);
}

console.log('✓ SUPABASE_URL format OK');

const supabase = createClient(url, key, { auth: { persistSession: false } });
let ok = true;

for (const table of ['tasks', 'expenses']) {
	const { error } = await supabase.from(table).select('id').limit(1);
	if (error) {
		console.error(`✗ Table "${table}": ${error.message}`);
		ok = false;
	} else {
		const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
		console.log(`✓ Table "${table}" exists (${count ?? 0} rows)`);
	}
}

if (!ok) {
	console.error('\n→ Tables missing? Run supabase/schema.sql in Supabase SQL Editor');
	console.error('→ "permission denied"? Run supabase/fix-permissions.sql in SQL Editor');
	console.error('→ Then: npm run db:import');
	process.exit(1);
}

/** Columns the app expects on tasks (added via supabase/migrations/*.sql in SQL Editor). */
const TASK_COLUMN_CHECKS = [
	{ name: 'checkin_date', migration: 'supabase/migrations/20260604_task_checkin.sql' },
	{ name: 'checkin_time', migration: 'supabase/migrations/20260604_task_checkin.sql' },
	{ name: 'hospitable_reservation_id', migration: 'supabase/migrations/20260605_task_hospitable_id.sql' },
];

const { error: checkinErr } = await supabase
	.from('tasks')
	.select('id, checkin_date, checkin_time, hospitable_reservation_id')
	.limit(1);

if (checkinErr?.code === '42703' || /checkin_|hospitable_reservation_id/i.test(checkinErr?.message || '')) {
	console.error('\n✗ tasks table is missing columns required for booking sync');
	console.error('  Supabase does NOT run files from supabase/migrations/ automatically.');
	console.error('  Run each file in Supabase → SQL Editor → New query → Run:');
	for (const migration of [...new Set(TASK_COLUMN_CHECKS.map((c) => c.migration))]) {
		console.error(`    - ${migration}`);
	}
	ok = false;
} else if (checkinErr) {
	console.error(`\n✗ tasks column check failed: ${checkinErr.message}`);
	ok = false;
} else {
	console.log('✓ tasks booking-sync columns exist (check-in + hospitable_reservation_id)');
}

console.log('\n— Bank / Plaid —');

const plaidConfigured = Boolean(
	process.env.PLAID_CLIENT_ID?.trim() && process.env.PLAID_SECRET?.trim(),
);
console.log(
	plaidConfigured
		? `✓ Plaid env set (PLAID_ENV=${process.env.PLAID_ENV || 'sandbox'})`
		: '○ Plaid env not in env.local — add PLAID_CLIENT_ID + PLAID_SECRET (or set in Cloudflare for prod only)',
);

for (const table of ['bank_connection', 'bank_transactions']) {
	const { error } = await supabase.from(table).select('id').limit(1);
	if (error) {
		console.error(`✗ Table "${table}": ${error.message}`);
		console.error('  → Run supabase/migrations/20260524_bank_transactions.sql in Supabase SQL Editor');
		ok = false;
	} else {
		const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
		console.log(`✓ Table "${table}" exists (${count ?? 0} rows)`);
	}
}

const { error: bkColErr } = await supabase
	.from('bank_transactions')
	.select('reviewed, hidden, notes, matched_reservation_id, matched_payout_amount')
	.limit(0);

if (bkColErr?.code === '42703' || /reviewed|hidden|notes/i.test(bkColErr?.message || '')) {
	console.error('✗ bank_transactions missing bookkeeping columns (reviewed, hidden, notes)');
	console.error('  → Run supabase/migrations/20260606_bank_transaction_categorization.sql in SQL Editor');
	ok = false;
} else if (bkColErr) {
	console.error(`✗ bank_transactions column check: ${bkColErr.message}`);
	ok = false;
} else {
	console.log('✓ bank_transactions bookkeeping columns exist');
}

const { data: bankConn } = await supabase
	.from('bank_connection')
	.select('institution_name, last_sync, item_id, accounts')
	.eq('id', 'default')
	.maybeSingle();

if (!bankConn?.item_id) {
	console.log('○ Bank not linked yet — Income → Connect Bank → Sync Now');
} else {
	const accountCount = Array.isArray(bankConn.accounts) ? bankConn.accounts.length : 0;
	console.log(`✓ Bank linked: ${bankConn.institution_name || 'institution'} (${accountCount} account(s))`);
	console.log(`  Last sync: ${bankConn.last_sync || 'never — click Sync Now on Income'}`);
	const { count: txCount } = await supabase
		.from('bank_transactions')
		.select('*', { count: 'exact', head: true });
	if ((txCount ?? 0) === 0) {
		console.log('○ No transactions imported yet — use Sync Now on Income');
	} else {
		console.log(`✓ ${txCount} bank transaction(s) in database`);
	}
}

if (!ok) {
	process.exit(1);
}

console.log('\nSupabase is ready.');
