/**
 * Expenses, bank data, and property records in Supabase Postgres.
 * API routes are already protected by iron-session; use SUPABASE_SERVICE_ROLE_KEY server-side only.
 */

import { getSupabase } from './supabase.js';
import { decryptSecret, encryptSecret } from './secrets.js';
import { categoryFilterValues } from './bookkeepingCategories.js';
import { applyPropertyIdFilter } from './dbPropertyFilter.js';
import { getReservationSplits, SPLIT_TYPES } from './reservationSplits.js';

const DB_UNREACHABLE_MESSAGE =
	'Database is unreachable. The Supabase project is likely paused or offline — '
	+ 'open the Supabase dashboard and resume the project, then retry.';

/**
 * True when an error looks like a connectivity failure rather than a query/schema error.
 * Supabase hosts sit behind Cloudflare, so a paused/offline project returns an
 * "error code: 1016" (origin DNS) page, the fetch fails outright, or it times out.
 */
export function isDbConnectivityError(error) {
	const message = String(error?.message || '');
	const status = error?.status ?? error?.statusCode;
	return (
		/error code: 10\d\d/i.test(message)
		|| /fetch failed|failed to fetch|ENOTFOUND|getaddrinfo|ECONNREFUSED|ETIMEDOUT|network|unreachable/i.test(message)
		|| error?.code === 'ECONNREFUSED'
		|| error?.code === 'ENOTFOUND'
		|| status === 1016
		|| status === 502
		|| status === 503
		|| status === 522
		|| status === 523
	);
}

export { DB_UNREACHABLE_MESSAGE };

function throwDbError(error) {
	if (isDbConnectivityError(error)) {
		throw new Error(DB_UNREACHABLE_MESSAGE);
	}
	if (error?.code === 'PGRST205') {
		throw new Error(
			'Database tables missing. In Supabase → SQL Editor, run the SQL in supabase/schema.sql, then: npm run db:import',
		);
	}
	// Postgres "undefined_column" surfaced via PostgREST/Supabase.
	// This usually means schema.sql was run once, but later migrations were not applied.
	if (error?.code === '42703') {
		const msg = String(error?.message || '');
		if (/bank_transactions/i.test(msg)) {
			throw new Error(
				'Database schema is missing bank_transactions columns required for bookkeeping. ' +
					'In Supabase → SQL Editor, run:\n' +
					'- supabase/migrations/20260606_bank_transaction_categorization.sql\n' +
					'- supabase/migrations/20260607_bank_transaction_reservation_match.sql',
			);
		}
		throw new Error(
			'Database schema is missing a required column. ' +
				'Supabase does not automatically run files in supabase/migrations/. ' +
				`Original error: ${msg || 'unknown column'}`,
		);
	}
	throw error;
}

function now() {
	return new Date().toISOString();
}

function sortExpenses(expenses) {
	return expenses.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function applyExpenseFilters(expenses) {
	return sortExpenses(expenses);
}

// ── Expenses ──────────────────────────────────────────────────

export async function createExpense(expense) {
	const supabase = getSupabase();
	const record = { ...expense, created_at: now() };
	const { data, error } = await supabase.from('expenses').insert(record).select().single();
	if (error) throwDbError(error);
	return data;
}

export async function getExpenses(filters = {}) {
	const supabase = getSupabase();
	let query = supabase.from('expenses').select('*');
	query = applyPropertyIdFilter(query, filters);
	if (filters.category) {
		const categoryValues = categoryFilterValues(filters.category);
		query = categoryValues.length > 1
			? query.in('category', categoryValues)
			: query.eq('category', categoryValues[0] || filters.category);
	}
	if (filters.date_from) query = query.gte('date', filters.date_from);
	if (filters.date_to) query = query.lte('date', filters.date_to);
	query = query.order('date', { ascending: false });

	const limit = filters.limit ?? 2000;
	const offset = filters.offset ?? 0;
	query = query.range(offset, offset + limit - 1);

	const { data, error } = await query;
	if (error) throwDbError(error);
	return applyExpenseFilters(data || []);
}

export async function getExpenseById(id) {
	const supabase = getSupabase();
	const { data, error } = await supabase.from('expenses').select('*').eq('id', id).maybeSingle();
	if (error) throwDbError(error);
	return data;
}

export async function updateExpense(id, updates) {
	const allowed = ['date', 'property_id', 'property_name', 'category', 'vendor', 'amount', 'notes', 'receipt_url'];
	const patch = {};
	allowed.forEach((k) => {
		if (updates[k] !== undefined) patch[k] = updates[k];
	});

	const supabase = getSupabase();
	const { data, error } = await supabase.from('expenses').update(patch).eq('id', id).select().maybeSingle();
	if (error) throwDbError(error);
	return data;
}

export async function deleteExpense(id) {
	const supabase = getSupabase();
	const { error } = await supabase.from('expenses').delete().eq('id', id);
	if (error) throwDbError(error);
}

// ── Bank (Plaid) ──────────────────────────────────────────────

export async function getBankConnection() {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('bank_connection')
		.select('*')
		.eq('id', 'default')
		.maybeSingle();
	if (error) throwDbError(error);
	if (data?.access_token) data.access_token = decryptSecret(data.access_token);
	return data;
}

export async function saveBankConnection(state) {
	const supabase = getSupabase();
	const record = {
		id: 'default',
		access_token: encryptSecret(state.accessToken),
		item_id: state.itemId,
		institution_name: state.institutionName,
		accounts: state.accounts || [],
		cursor: state.cursor ?? null,
		last_sync: state.lastSync ?? null,
		updated_at: now(),
	};
	const { data, error } = await supabase
		.from('bank_connection')
		.upsert(record)
		.select()
		.single();
	if (error) throwDbError(error);
	if (data?.access_token) data.access_token = decryptSecret(data.access_token);
	return data;
}

export async function clearBankTransactions() {
	const supabase = getSupabase();
	const { error } = await supabase.from('bank_transactions').delete().not('id', 'is', null);
	if (error) throwDbError(error);
}

export async function disconnectBankConnection({ deleteTransactions = false } = {}) {
	const supabase = getSupabase();
	const existing = await getBankConnection();
	if (deleteTransactions) await clearBankTransactions();
	const { error } = await supabase.from('bank_connection').delete().eq('id', 'default');
	if (error) throwDbError(error);
	return { hadConnection: Boolean(existing?.access_token), accessToken: existing?.access_token || null };
}

export async function getBankTransactionsByExternalIds(externalIds) {
	if (!externalIds?.length) return [];
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('bank_transactions')
		.select('external_id, category, property_id, reviewed, hidden, notes, matched_reservation_id, matched_payout_amount, reservation_splits')
		.in('external_id', externalIds);
	if (error) throwDbError(error);
	return data || [];
}

export async function upsertBankTransactions(transactions) {
	if (!transactions?.length) return [];
	const supabase = getSupabase();
	const ts = now();
	const existing = await getBankTransactionsByExternalIds(
		transactions.map((tx) => tx.externalId),
	);
	const existingByExternal = new Map(existing.map((row) => [row.external_id, row]));

	const records = transactions.map((tx) => {
		const prev = existingByExternal.get(tx.externalId);
		const plaidCategory = tx.category || '';
		return {
			id: tx.id,
			external_id: tx.externalId,
			source: tx.source || 'plaid',
			date: tx.date,
			description: tx.description,
			amount: tx.amount,
			account: tx.account || null,
			account_id: tx.accountId || null,
			pending: Boolean(tx.pending),
			category: prev?.category?.trim() ? prev.category : plaidCategory,
			property_id: prev?.property_id ?? tx.propertyId ?? null,
			reviewed: prev?.reviewed ?? false,
			hidden: prev?.hidden ?? false,
			notes: prev?.notes ?? '',
			matched_reservation_id: prev?.matched_reservation_id ?? null,
			matched_payout_amount: prev?.matched_payout_amount ?? null,
			reservation_splits: prev?.reservation_splits ?? [],
			updated_at: ts,
		};
	});

	const { data, error } = await supabase
		.from('bank_transactions')
		.upsert(records, { onConflict: 'external_id' })
		.select();
	if (error) throwDbError(error);
	return data || [];
}

export async function deleteBankTransactionsByExternalIds(externalIds) {
	const ids = (externalIds || []).filter(Boolean);
	if (!ids.length) return 0;
	const supabase = getSupabase();
	const { error } = await supabase
		.from('bank_transactions')
		.delete()
		.in('external_id', ids);
	if (error) throwDbError(error);
	return ids.length;
}

export async function getBankTransactions(filters = {}) {
	const supabase = getSupabase();
	let query = supabase.from('bank_transactions').select('*');
	if (filters.date_from) query = query.gte('date', filters.date_from);
	if (filters.date_to) query = query.lte('date', filters.date_to);
	if (filters.account_id) query = query.eq('account_id', filters.account_id);
	query = applyPropertyIdFilter(query, filters);
	if (filters.category) {
		const categoryValues = categoryFilterValues(filters.category);
		query = categoryValues.length > 1
			? query.in('category', categoryValues)
			: query.eq('category', categoryValues[0] || filters.category);
	}
	if (filters.uncategorized) query = query.or('category.is.null,category.eq.');
	if (filters.reviewed === 'true') query = query.eq('reviewed', true);
	if (filters.reviewed === 'false') query = query.eq('reviewed', false);
	if (filters.hidden === 'true') query = query.eq('hidden', true);
	if (filters.hidden === 'false') query = query.eq('hidden', false);
	query = query.order('date', { ascending: false });

	const limit = filters.limit ?? 2000;
	const offset = filters.offset ?? 0;
	query = query.range(offset, offset + limit - 1);

	const { data, error } = await query;
	if (error) throwDbError(error);
	return data || [];
}

export async function getBankTransactionById(id) {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('bank_transactions')
		.select('*')
		.eq('id', id)
		.maybeSingle();
	if (error) throwDbError(error);
	return data;
}

export async function sumMatchedIncomeForReservation(reservationId, { excludeTransactionId } = {}) {
	if (!reservationId) return 0;
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('bank_transactions')
		.select('id, amount, matched_reservation_id, reservation_splits')
		.or(`matched_reservation_id.eq.${reservationId},reservation_splits.neq.[]`);
	if (error) throwDbError(error);

	let sum = 0;
	for (const row of data || []) {
		if (excludeTransactionId && row.id === excludeTransactionId) continue;
		for (const split of getReservationSplits(row)) {
			if (split.reservation_id !== reservationId) continue;
			if (split.type !== SPLIT_TYPES.INCOME) continue;
			const amt = Number(split.amount) || 0;
			if (amt > 0) sum += amt;
		}
	}
	return sum;
}

export async function updateBankTransaction(id, patch) {
	const supabase = getSupabase();
	const allowed = [
		'category', 'property_id', 'reviewed', 'hidden', 'notes',
		'matched_reservation_id', 'matched_payout_amount', 'reservation_splits',
	];
	const updates = { updated_at: now() };
	for (const key of allowed) {
		if (patch[key] !== undefined) updates[key] = patch[key];
	}
	if (Object.keys(updates).length === 1) return null;

	const { data, error } = await supabase
		.from('bank_transactions')
		.update(updates)
		.eq('id', id)
		.select()
		.single();
	if (error) throwDbError(error);
	return data;
}

export async function updateBankTransactionsBulk(ids, patch) {
	if (!ids?.length) return [];
	const supabase = getSupabase();
	const allowed = ['category', 'property_id', 'reviewed', 'hidden'];
	const updates = { updated_at: now() };
	for (const key of allowed) {
		if (patch[key] !== undefined) updates[key] = patch[key];
	}
	if (Object.keys(updates).length === 1) return [];

	const { data, error } = await supabase
		.from('bank_transactions')
		.update(updates)
		.in('id', ids)
		.select();
	if (error) throwDbError(error);
	return data || [];
}
