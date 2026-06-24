/**
 * Tasks and expenses stored in Supabase Postgres.
 * API routes are already protected by iron-session; use SUPABASE_SERVICE_ROLE_KEY server-side only.
 */

import { getSupabase } from './supabase.js';
import { todayIso } from './dates.js';
import { sortTasksByDateAsc } from './constants.js';
import { decryptSecret, encryptSecret } from './secrets.js';
import { categoryFilterValues } from './bookkeepingCategories.js';
import { applyPropertyIdFilter } from './dbPropertyFilter.js';
import { getReservationSplits, SPLIT_TYPES } from './reservationSplits.js';
import { applyTaskHistoryPatches } from './taskHistory.js';

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
		if (/tasks/i.test(msg) && /(checkin_date|checkin_time|hospitable_reservation_id)/i.test(msg)) {
			throw new Error(
				'Database schema is missing tasks columns required for reservation sync. ' +
					'In Supabase → SQL Editor, run:\n' +
					'- supabase/migrations/20260604_task_checkin.sql\n' +
					'- supabase/migrations/20260605_task_hospitable_id.sql',
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

// ── Tasks ─────────────────────────────────────────────────────

export async function createTask(task) {
	const supabase = getSupabase();
	const ts = now();
	const record = {
		...task,
		created_at: ts,
		updated_at: ts,
	};
	const { data, error } = await supabase.from('tasks').insert(record).select().single();
	if (error) throwDbError(error);
	return data;
}

const RESERVATION_SYNC_FIELDS = [
	'reservation_id',
	'hospitable_reservation_id',
	'property_id',
	'property_name',
	'guest_name',
	'has_pets',
	'pet_count',
	'checklist_url',
	'title',
	'description',
	'checkin_date',
	'checkin_time',
	'due_date',
	'due_time',
	'checkout_date',
	'start_time',
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isLegacyReservationId(value) {
	return UUID_RE.test(String(value || '').trim());
}

/**
 * Find a task linked to a reservation.
 * @param {object} task — lookup keys: reservation_id, hospitable_reservation_id, property_id, checkout_date
 * @param {{ allowPropertyDateFallback?: boolean }} options
 *   Property+date fallback is only for migrating legacy UUID rows on upsert — never for deletes,
 *   because multiple bookings can share the same property checkout day (e.g. cancelled + rebooked).
 */
export async function findExistingTaskForReservation(task, { allowPropertyDateFallback = true } = {}) {
	const supabase = getSupabase();
	const code = task.reservation_id?.trim();
	const legacyId = task.hospitable_reservation_id?.trim();

	if (code) {
		const { data: byCode, error: codeErr } = await supabase
			.from('tasks')
			.select('*')
			.ilike('reservation_id', code)
			.maybeSingle();
		if (codeErr) throwDbError(codeErr);
		if (byCode) return byCode;
	}

	if (legacyId) {
		const { data: byStoredUuid, error: storedErr } = await supabase
			.from('tasks')
			.select('*')
			.eq('hospitable_reservation_id', legacyId)
			.maybeSingle();
		if (storedErr) throwDbError(storedErr);
		if (byStoredUuid) return byStoredUuid;

		const { data: byUuid, error: uuidErr } = await supabase
			.from('tasks')
			.select('*')
			.eq('reservation_id', legacyId)
			.maybeSingle();
		if (uuidErr) throwDbError(uuidErr);
		if (byUuid) return byUuid;
	}

	const lookupIds = [...new Set([code, legacyId].filter(Boolean))];
	if (task.property_id && lookupIds.length) {
		const { data: rows, error: rowErr } = await supabase
			.from('tasks')
			.select('*')
			.eq('property_id', task.property_id)
			.eq('type', 'turnover')
			.in('reservation_id', lookupIds);
		if (rowErr) throwDbError(rowErr);
		if (rows?.length === 1) return rows[0];
	}

	// Legacy: match old rows still keyed by UUID when checkout date on file is stale.
	if (allowPropertyDateFallback && task.property_id && task.checkout_date) {
		const { data: rows, error: rowErr } = await supabase
			.from('tasks')
			.select('*')
			.eq('property_id', task.property_id)
			.eq('checkout_date', task.checkout_date)
			.eq('type', 'turnover');
		if (rowErr) throwDbError(rowErr);
		if (rows?.length === 1 && isLegacyReservationId(rows[0].reservation_id)) {
			return rows[0];
		}
	}

	return null;
}

/** Update schedule fields on an existing task matched by reservation code / Hospitable id. */
export async function patchTaskScheduleFromReservation(patch) {
	const existing = await findExistingTaskForReservation(patch, { allowPropertyDateFallback: false });
	if (!existing) return { task: null, updated: false, previousTask: null };

	const scheduleFields = [
		'hospitable_reservation_id',
		'property_id',
		'checkin_date',
		'checkin_time',
		'checkout_date',
		'due_date',
		'due_time',
		'start_time',
	];
	const row = { updated_at: now() };
	scheduleFields.forEach((k) => {
		if (patch[k] !== undefined) row[k] = patch[k];
	});

	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('tasks')
		.update(row)
		.eq('id', existing.id)
		.select()
		.single();
	if (error) throwDbError(error);
	return { task: data, updated: true, previousTask: existing, isNew: false };
}

export async function upsertTaskFromReservation(task) {
	const supabase = getSupabase();
	const existing = await findExistingTaskForReservation(task);

	if (existing) {
		const patch = { updated_at: now() };
		RESERVATION_SYNC_FIELDS.forEach((k) => {
			if (task[k] !== undefined) patch[k] = task[k];
		});
		const { data, error } = await supabase
			.from('tasks')
			.update(patch)
			.eq('id', existing.id)
			.select()
			.single();
		if (error) throwDbError(error);
		return { task: data, isNew: false, previousTask: existing };
	}

	const created = await createTask({
		...task,
		status: 'unassigned',
		assignee: null,
	});
	return { task: created, isNew: true, previousTask: null };
}

/** Delete a turnover task linked to a reservation (no notification). */
export async function deleteTaskForReservationLookup(lookup) {
	const existing = await findExistingTaskForReservation(lookup, { allowPropertyDateFallback: false });
	if (!existing) return false;
	await deleteTask(existing.id);
	return true;
}

function taskMatchesCancelledReservation(row, { code, hospitableId }) {
	if (!row) return false;
	if (hospitableId && row.hospitable_reservation_id === hospitableId) return true;
	if (hospitableId && row.reservation_id === hospitableId) return true;
	if (code && String(row.reservation_id || '').toUpperCase() === code) return true;
	if (code) {
		const title = String(row.title || '').toUpperCase();
		if (title.startsWith(`${code} `) || title.startsWith(`${code}-`)) return true;
	}
	return isLegacyReservationId(row.reservation_id);
}

async function findTaskByTitleReservationCode(code) {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('tasks')
		.select('*')
		.ilike('title', `${code}%`)
		.eq('type', 'turnover')
		.limit(2);
	if (error) throwDbError(error);
	if (data?.length === 1) return data[0];
	return null;
}

async function findTurnoverForCancelledAtPropertyCheckout(lookup, { code, hospitableId }) {
	if (!lookup.property_id || !lookup.checkout_date) return null;
	const supabase = getSupabase();
	const { data: rows, error } = await supabase
		.from('tasks')
		.select('*')
		.eq('property_id', lookup.property_id)
		.eq('checkout_date', lookup.checkout_date)
		.eq('type', 'turnover');
	if (error) throwDbError(error);
	if (!rows?.length) return null;

	const matches = rows.filter((row) => taskMatchesCancelledReservation(row, { code, hospitableId }));
	if (matches.length === 1) return matches[0];
	if (rows.length === 1 && isLegacyReservationId(rows[0].reservation_id)) return rows[0];
	return null;
}

/**
 * Remove the turnover task for a cancelled/declined reservation.
 * Uses broader matching than deleteTaskForReservationLookup (title prefix, legacy property+date).
 */
export async function deleteTaskForCancelledReservation(lookup, { code, hospitableId } = {}) {
	let existing = await findExistingTaskForReservation(lookup, { allowPropertyDateFallback: false });
	if (!existing) {
		existing = await findExistingTaskForReservation(lookup, { allowPropertyDateFallback: true });
	}
	if (!existing && code) {
		existing = await findTaskByTitleReservationCode(code);
	}
	if (!existing) {
		existing = await findTurnoverForCancelledAtPropertyCheckout(lookup, { code, hospitableId });
	}
	if (!existing) return false;
	await deleteTask(existing.id);
	return true;
}

/** Load all turnover tasks once (used by batched reservation sync on Cloudflare Workers). */
export async function loadTurnoverTasksForSync() {
	const supabase = getSupabase();
	const { data, error } = await supabase.from('tasks').select('*').eq('type', 'turnover');
	if (error) throwDbError(error);
	return data || [];
}

/** Apply batched inserts/updates/deletes from sync (few subrequests). */
export async function applySyncMutations({ inserts = [], updates = [], deleteIds = [] } = {}) {
	const supabase = getSupabase();
	const uniqueDeleteIds = [...new Set(deleteIds.filter(Boolean))];

	if (uniqueDeleteIds.length) {
		const { error } = await supabase.from('tasks').delete().in('id', uniqueDeleteIds);
		if (error) throwDbError(error);
	}

	if (updates.length) {
		const { error } = await supabase.from('tasks').upsert(updates, { onConflict: 'id' });
		if (error) throwDbError(error);
	}

	if (inserts.length) {
		const { error } = await supabase.from('tasks').insert(inserts);
		if (error) throwDbError(error);
	}
}

export async function getTasks(filters = {}) {
	const supabase = getSupabase();
	let query = supabase.from('tasks').select('*');
	if (filters.due_date) query = query.eq('due_date', filters.due_date);
	if (filters.property_id) query = query.eq('property_id', filters.property_id);
	if (filters.status) query = query.eq('status', filters.status);
	if (filters.assignee) query = query.eq('assignee', filters.assignee);
	if (filters.type) query = query.eq('type', filters.type);
	if (filters.date_from) query = query.gte('due_date', filters.date_from);
	if (filters.date_to) query = query.lte('due_date', filters.date_to);
	if (filters.unassigned) query = query.or('assignee.is.null,assignee.eq.');
	if (filters.assigned) query = query.not('assignee', 'is', null).neq('assignee', '');
	if (filters.exclude_completed) {
		query = query.neq('status', 'completed').neq('status', 'under_review');
	}
	if (filters.overdue) query = query.lt('due_date', todayIso());
	if (filters.exclude_overdue) query = query.gte('due_date', todayIso());

	const soonest = Boolean(filters.sort_soonest);
	query = query
		.order('checkout_date', { ascending: soonest, nullsFirst: false })
		.order('due_date', { ascending: soonest })
		.order('due_time', { ascending: soonest });

	const limit = filters.limit ?? 2000;
	const offset = filters.offset ?? 0;
	query = query.range(offset, offset + limit - 1);

	const { data, error } = await query;
	if (error) throwDbError(error);
	const rows = data || [];
	if (filters.sort_soonest) return sortTasksByDateAsc(rows);
	return rows;
}

export async function getTaskById(id) {
	const supabase = getSupabase();
	const { data, error } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle();
	if (error) throwDbError(error);
	return data;
}

export async function getTaskByReservationId(reservationId) {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('tasks')
		.select('*')
		.eq('reservation_id', reservationId)
		.maybeSingle();
	if (error) throwDbError(error);
	return data;
}

export async function updateTask(id, updates, { previousTask } = {}) {
	const allowed = [
		'status',
		'assignee',
		'notes',
		'reservation_id',
		'property_id',
		'checkin_date',
		'checkin_time',
		'due_date',
		'due_time',
		'start_time',
		'checkout_date',
		'title',
		'description',
		'property_name',
		'guest_name',
		'checklist_url',
		'fillout_submission_id',
		'checklist_submission_url',
		'checklist_pdf_url',
		'submitted_at',
		'approved_at',
		'completed_at',
	];
	const historyPatch = previousTask ? applyTaskHistoryPatches(previousTask, updates) : updates;
	const patch = { updated_at: now() };
	allowed.forEach((k) => {
		if (historyPatch[k] !== undefined) patch[k] = historyPatch[k];
	});

	const supabase = getSupabase();
	const { data, error } = await supabase.from('tasks').update(patch).eq('id', id).select().maybeSingle();
	if (error) throwDbError(error);
	return data;
}

export async function deleteTask(id) {
	const supabase = getSupabase();
	const { error } = await supabase.from('tasks').delete().eq('id', id);
	if (error) throwDbError(error);
}

export async function getTasksForToday() {
	return getTasks({
		due_date: todayIso(),
		exclude_completed: true,
		sort_soonest: true,
	});
}

export async function getUnassignedTasksCount() {
	const supabase = getSupabase();
	const { count, error } = await supabase
		.from('tasks')
		.select('*', { count: 'exact', head: true })
		.eq('status', 'unassigned');
	if (error) throwDbError(error);
	return count ?? 0;
}

/** Fast nav/dashboard counts — mirrors countTasksByIndicator without loading every row. */
export async function getTaskIndicatorCounts({ assignee } = {}) {
	const supabase = getSupabase();
	const today = todayIso();
	const activeStatus = '("completed","under_review")';

	function applyAssignee(query) {
		if (assignee) return query.eq('assignee', assignee);
		return query;
	}

	const [completed, under_review, overdue, unassigned, assigned] = await Promise.all([
		applyAssignee(supabase.from('tasks').select('*', { count: 'exact', head: true }))
			.eq('status', 'completed'),
		applyAssignee(supabase.from('tasks').select('*', { count: 'exact', head: true }))
			.eq('status', 'under_review'),
		applyAssignee(supabase.from('tasks').select('*', { count: 'exact', head: true }))
			.lt('due_date', today)
			.not('status', 'in', activeStatus),
		applyAssignee(supabase.from('tasks').select('*', { count: 'exact', head: true }))
			.or('assignee.is.null,assignee.eq.')
			.not('status', 'in', activeStatus)
			.gte('due_date', today),
		applyAssignee(supabase.from('tasks').select('*', { count: 'exact', head: true }))
			.not('assignee', 'is', null)
			.neq('assignee', '')
			.not('status', 'in', activeStatus)
			.gte('due_date', today),
	]);

	for (const result of [completed, under_review, overdue, unassigned, assigned]) {
		if (result.error) throwDbError(result.error);
	}

	return {
		unassigned: unassigned.count ?? 0,
		assigned: assigned.count ?? 0,
		under_review: under_review.count ?? 0,
		completed: completed.count ?? 0,
		overdue: overdue.count ?? 0,
	};
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

export async function deleteBankTransaction(id) {
	const supabase = getSupabase();
	const { error } = await supabase.from('bank_transactions').delete().eq('id', id);
	if (error) throwDbError(error);
}

// ── Property details & owners ─────────────────────────────────

function uniquePropertyIds(propertyIds) {
	return [...new Set((propertyIds || []).map((id) => String(id).trim()).filter(Boolean))];
}

export async function getPropertyDetails(propertyId) {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('property_details')
		.select('*')
		.eq('property_id', propertyId)
		.maybeSingle();
	if (error) throwDbError(error);
	return data;
}

export async function upsertPropertyDetails(propertyId, patch) {
	const supabase = getSupabase();
	const record = {
		property_id: propertyId,
		...patch,
		updated_at: now(),
	};
	const { data, error } = await supabase
		.from('property_details')
		.upsert(record, { onConflict: 'property_id' })
		.select()
		.single();
	if (error) throwDbError(error);
	return data;
}

export async function getPropertyOwner(propertyId) {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('property_owners')
		.select('*')
		.eq('property_id', propertyId)
		.maybeSingle();
	if (error) throwDbError(error);
	return data;
}

export async function upsertPropertyOwner(propertyId, patch) {
	const supabase = getSupabase();
	const record = {
		property_id: propertyId,
		...patch,
		updated_at: now(),
	};
	const { data, error } = await supabase
		.from('property_owners')
		.upsert(record, { onConflict: 'property_id' })
		.select()
		.single();
	if (error) throwDbError(error);
	return data;
}

export async function getPropertyOwners(propertyIds) {
	const ids = uniquePropertyIds(propertyIds);
	if (!ids.length) return [];
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('property_owners')
		.select('*')
		.in('property_id', ids);
	if (error) throwDbError(error);
	return data || [];
}

// ── Owner statements ──────────────────────────────────────────

const OWNER_STATEMENT_PDF_BUCKET = 'owner-statements';

function base64ToUint8Array(base64) {
	if (typeof Buffer !== 'undefined') {
		return new Uint8Array(Buffer.from(base64, 'base64'));
	}
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

async function uploadOwnerStatementPdf(propertyId, pdfBase64, statementPeriod) {
	const bytes = base64ToUint8Array(pdfBase64);
	const safe = String(statementPeriod || 'statement')
		.replace(/[^a-zA-Z0-9._-]+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '') || 'statement';
	const storagePath = `${propertyId}/${Date.now()}-${safe}.pdf`;
	const supabase = getSupabase();
	const { error } = await supabase.storage
		.from(OWNER_STATEMENT_PDF_BUCKET)
		.upload(storagePath, bytes, { contentType: 'application/pdf', upsert: false });
	if (error) throwDbError(error);
	return storagePath;
}

export async function getOwnerStatementInclusionForReservation(property_id, reservation_id) {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('owner_statement_inclusions')
		.select('*')
		.eq('property_id', property_id)
		.eq('reservation_id', reservation_id)
		.maybeSingle();
	if (error) throwDbError(error);
	return data;
}

export async function setOwnerStatementInclusion({
	property_id,
	reservation_id,
	statement_month,
	included,
}) {
	const supabase = getSupabase();
	if (!included) {
		const { error } = await supabase
			.from('owner_statement_inclusions')
			.delete()
			.eq('property_id', property_id)
			.eq('reservation_id', reservation_id);
		if (error) throwDbError(error);
		return null;
	}

	const record = {
		property_id,
		reservation_id,
		statement_month,
	};
	const { data, error } = await supabase
		.from('owner_statement_inclusions')
		.upsert(record, { onConflict: 'property_id,reservation_id' })
		.select()
		.single();
	if (error) throwDbError(error);
	return data;
}

export async function getOwnerStatementInclusions(propertyIds) {
	const ids = uniquePropertyIds(propertyIds);
	if (!ids.length) return [];
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('owner_statement_inclusions')
		.select('*')
		.in('property_id', ids);
	if (error) throwDbError(error);
	return data || [];
}

export async function upsertOwnerStatementNotes({ property_id, reservation_id, notes }) {
	const supabase = getSupabase();
	const record = {
		property_id,
		reservation_id,
		notes: notes == null ? '' : String(notes),
		updated_at: now(),
	};
	const { data, error } = await supabase
		.from('owner_statement_reservation_notes')
		.upsert(record, { onConflict: 'property_id,reservation_id' })
		.select()
		.single();
	if (error) throwDbError(error);
	return data;
}

export async function getOwnerStatementNotes(propertyIds) {
	const ids = uniquePropertyIds(propertyIds);
	if (!ids.length) return [];
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('owner_statement_reservation_notes')
		.select('*')
		.in('property_id', ids);
	if (error) throwDbError(error);
	return data || [];
}

export async function setOwnerStatementCashInclusion({
	property_id,
	item_id,
	item_source,
	statement_month,
	included,
}) {
	const supabase = getSupabase();
	if (!included) {
		const { error } = await supabase
			.from('owner_statement_cash_inclusions')
			.delete()
			.eq('property_id', property_id)
			.eq('item_id', item_id)
			.eq('item_source', item_source);
		if (error) throwDbError(error);
		return null;
	}

	const record = {
		property_id,
		item_id,
		item_source,
		statement_month,
	};
	const { data, error } = await supabase
		.from('owner_statement_cash_inclusions')
		.upsert(record, { onConflict: 'property_id,item_id,item_source' })
		.select()
		.single();
	if (error) throwDbError(error);
	return data;
}

export async function getOwnerStatementApproval(id) {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('owner_statement_approvals')
		.select('*')
		.eq('id', id)
		.maybeSingle();
	if (error) throwDbError(error);
	return data;
}

export async function getOwnerStatementApprovalsForProperties(propertyIds) {
	const ids = uniquePropertyIds(propertyIds);
	if (!ids.length) return [];
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('owner_statement_approvals')
		.select('*')
		.in('property_id', ids)
		.order('approved_at', { ascending: false });
	if (error) throwDbError(error);
	return data || [];
}

export async function getPropertyOwnerStatementApprovals(propertyId) {
	return getOwnerStatementApprovalsForProperties([propertyId]);
}

export async function saveOwnerStatementApprovals(statements, {
	date_from,
	date_to,
	pdfsByPropertyId = {},
} = {}) {
	if (!statements?.length) return [];
	const supabase = getSupabase();
	const results = [];

	for (const statement of statements) {
		const property_id = statement.property_id;
		const reservation_ids = (statement.reservations || []).map((row) => row.id).filter(Boolean);
		let pdf_storage_path = null;
		const pdfBase64 = pdfsByPropertyId[property_id];
		if (pdfBase64) {
			pdf_storage_path = await uploadOwnerStatementPdf(
				property_id,
				pdfBase64,
				statement.statement_period,
			);
		}

		const record = {
			property_id,
			statement_period: statement.statement_period || '',
			date_from: date_from || null,
			date_to: date_to || null,
			reservation_ids,
			statement_data: statement,
			pdf_storage_path,
		};
		const { data, error } = await supabase
			.from('owner_statement_approvals')
			.insert(record)
			.select()
			.single();
		if (error) throwDbError(error);
		results.push(data);
	}

	return results;
}

export async function downloadOwnerStatementPdf(storagePath) {
	const supabase = getSupabase();
	const { data, error } = await supabase.storage
		.from(OWNER_STATEMENT_PDF_BUCKET)
		.download(storagePath);
	if (error) throwDbError(error);
	return data;
}
