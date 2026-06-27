#!/usr/bin/env node
/**
 * Verify Supabase env + that core tables exist.
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

for (const table of ['expenses']) {
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

console.log('\n— In-app checklist forms —');

for (const table of ['form_submissions', 'form_submission_files']) {
	const { error } = await supabase.from(table).select('id').limit(1);
	if (error?.code === 'PGRST205' || /Could not find the table/i.test(error?.message || '')) {
		console.error(`✗ Table "${table}" missing`);
		console.error('  → Run supabase/migrations/20260625_form_submissions.sql in Supabase SQL Editor');
		ok = false;
	} else if (error?.code === '42501' || /permission denied/i.test(error?.message || '')) {
		console.error(`✗ Table "${table}": permission denied for service_role`);
		console.error('  → Run supabase/migrations/20260629_form_submission_permissions.sql in Supabase SQL Editor');
		ok = false;
	} else if (error) {
		console.error(`✗ Table "${table}": ${error.message}`);
		ok = false;
	} else {
		const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
		console.log(`✓ Table "${table}" exists (${count ?? 0} rows)`);
	}
}

const { error: formStatusErr } = await supabase
	.from('form_submissions')
	.select('id, status')
	.limit(0);

if (formStatusErr?.code === '42703' || /status/i.test(formStatusErr?.message || '')) {
	console.error('✗ form_submissions missing status column');
	console.error('  → Run supabase/migrations/20260628_form_submission_status.sql in Supabase SQL Editor');
	ok = false;
} else if (formStatusErr) {
	console.error(`✗ form_submissions status check: ${formStatusErr.message}`);
	ok = false;
} else {
	console.log('✓ form_submissions status column exists');
}

console.log('\n— Supplies —');

for (const table of ['supply_products', 'supply_inventory', 'supply_orders', 'supply_order_items']) {
	const { error } = await supabase.from(table).select('id').limit(1);
	if (error?.code === 'PGRST205' || /Could not find the table/i.test(error?.message || '')) {
		console.error(`✗ Table "${table}" missing`);
		console.error('  → Run supabase/migrations/20260622_supplies.sql in Supabase SQL Editor');
		ok = false;
	} else if (error?.code === '42501') {
		console.error(`✗ Table "${table}": permission denied for service_role`);
		console.error('  → Run supabase/migrations/20260625_supply_permissions.sql in Supabase SQL Editor');
		ok = false;
	} else if (error) {
		console.error(`✗ Table "${table}": ${error.message}`);
		ok = false;
	} else {
		const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
		console.log(`✓ Table "${table}" exists (${count ?? 0} rows)`);
	}
}

const { error: supplyOrderColErr } = await supabase
	.from('supply_orders')
	.select('delivered_at, paid_at, paid_by, expense_id')
	.limit(0);

if (supplyOrderColErr?.code === '42703' || /delivered_at|paid_at|paid_by|expense_id/i.test(supplyOrderColErr?.message || '')) {
	console.error('✗ supply_orders missing delivery/payment columns (delivered_at, paid_at, paid_by, expense_id)');
	console.error('  → Run supabase/migrations/20260712_supply_order_delivered_paid.sql in Supabase SQL Editor');
	ok = false;
} else if (supplyOrderColErr) {
	console.error(`✗ supply_orders column check: ${supplyOrderColErr.message}`);
	ok = false;
} else {
	console.log('✓ supply_orders delivery/payment columns exist');
}

console.log('\n— Guest checkout —');

{
	const { error } = await supabase.from('guest_checkouts').select('id').limit(1);
	if (error?.code === 'PGRST205' || /Could not find the table/i.test(error?.message || '')) {
		console.error('✗ Table "guest_checkouts" missing');
		console.error('  → Run supabase/migrations/20260708_guest_checkouts.sql in Supabase SQL Editor');
		ok = false;
	} else if (error?.code === '42501' || /permission denied/i.test(error?.message || '')) {
		console.error('✗ Table "guest_checkouts": permission denied for service_role');
		console.error('  → Run supabase/migrations/20260710_guest_checkouts_permissions.sql in Supabase SQL Editor');
		ok = false;
	} else if (error) {
		console.error(`✗ Table "guest_checkouts": ${error.message}`);
		ok = false;
	} else {
		const { count } = await supabase.from('guest_checkouts').select('*', { count: 'exact', head: true });
		console.log(`✓ Table "guest_checkouts" exists (${count ?? 0} rows)`);
	}
}

console.log('\n— Tasks —');

const { error: overdueColErr } = await supabase
	.from('tasks')
	.select('overdue_notified_at')
	.limit(0);

if (overdueColErr?.code === '42703' || /overdue_notified_at/i.test(overdueColErr?.message || '')) {
	console.error('✗ tasks missing overdue_notified_at column');
	console.error('  → Run supabase/migrations/20260715_task_overdue_notified.sql in SQL Editor');
	ok = false;
} else if (overdueColErr) {
	console.error(`✗ tasks column check: ${overdueColErr.message}`);
	ok = false;
} else {
	console.log('✓ tasks overdue_notified_at column exists');
}

const { error: archivedColErr } = await supabase
	.from('tasks')
	.select('archived_at')
	.limit(0);

if (archivedColErr?.code === '42703' || /archived_at/i.test(archivedColErr?.message || '')) {
	console.error('✗ tasks missing archived_at column');
	console.error('  → Run supabase/migrations/20260627_task_archived.sql in SQL Editor');
	ok = false;
} else if (archivedColErr) {
	console.error(`✗ tasks column check: ${archivedColErr.message}`);
	ok = false;
} else {
	console.log('✓ tasks archived_at column exists');
}

console.log('\n— Push notifications —');

{
	const { error } = await supabase.from('push_subscriptions').select('id').limit(1);
	if (error?.code === 'PGRST205' || /Could not find the table/i.test(error?.message || '')) {
		console.error('✗ Table "push_subscriptions" missing');
		console.error('  → Run supabase/migrations/20260714_push_subscriptions.sql in Supabase SQL Editor');
		ok = false;
	} else if (error?.code === '42501' || /permission denied/i.test(error?.message || '')) {
		console.error('✗ Table "push_subscriptions": permission denied for service_role');
		console.error('  → Re-run supabase/migrations/20260714_push_subscriptions.sql in Supabase SQL Editor');
		ok = false;
	} else if (error) {
		console.error(`✗ Table "push_subscriptions": ${error.message}`);
		ok = false;
	} else {
		const { count } = await supabase.from('push_subscriptions').select('*', { count: 'exact', head: true });
		console.log(`✓ Table "push_subscriptions" exists (${count ?? 0} rows)`);
	}
}

console.log('\n— Billpay —');

for (const table of ['billpay_invoices']) {
	const { error } = await supabase.from(table).select('id').limit(1);
	if (error?.code === 'PGRST205' || /Could not find the table/i.test(error?.message || '')) {
		console.error(`✗ Table "${table}" missing`);
		console.error('  → Run supabase/migrations/20260705_billpay_invoices.sql in Supabase SQL Editor');
		ok = false;
	} else if (error) {
		console.error(`✗ Table "${table}": ${error.message}`);
		ok = false;
	} else {
		const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
		console.log(`✓ Table "${table}" exists (${count ?? 0} rows)`);
	}
}

if (!ok) {
	process.exit(1);
}

console.log('\nSupabase is ready.');
