/**
 * Tasks and expenses stored in Supabase Postgres.
 * API routes are already protected by iron-session; use SUPABASE_SERVICE_ROLE_KEY server-side only.
 */

import { getSupabase } from './supabase.js';
import { todayIso } from './dates.js';

function throwDbError(error) {
	if (error?.code === 'PGRST205') {
		throw new Error(
			'Database tables missing. In Supabase → SQL Editor, run the SQL in supabase/schema.sql, then: npm run db:import',
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
	'property_id',
	'property_name',
	'guest_name',
	'checklist_url',
	'title',
	'description',
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
async function findExistingTaskForReservation(task, { allowPropertyDateFallback = true } = {}) {
	const supabase = getSupabase();

	const { data: byCode, error: codeErr } = await supabase
		.from('tasks')
		.select('*')
		.eq('reservation_id', task.reservation_id)
		.maybeSingle();
	if (codeErr) throwDbError(codeErr);
	if (byCode) return byCode;

	const legacyId = task.hospitable_reservation_id;
	if (legacyId) {
		const { data: byUuid, error: uuidErr } = await supabase
			.from('tasks')
			.select('*')
			.eq('reservation_id', legacyId)
			.maybeSingle();
		if (uuidErr) throwDbError(uuidErr);
		if (byUuid) return byUuid;
	}

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

	const { hospitable_reservation_id: _legacy, ...record } = task;
	const created = await createTask({
		...record,
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
	if (filters.exclude_completed) query = query.neq('status', 'completed');
	if (filters.overdue) query = query.lt('due_date', todayIso());
	if (filters.exclude_overdue) query = query.gte('due_date', todayIso());

	if (filters.status === 'completed') {
		query = query
			.order('checkout_date', { ascending: false, nullsFirst: false })
			.order('due_date', { ascending: false });
	} else {
		const ascending = Boolean(filters.unassigned);
		query = query.order('due_date', { ascending }).order('due_time', { ascending });
	}

	const limit = filters.limit ?? 2000;
	const offset = filters.offset ?? 0;
	query = query.range(offset, offset + limit - 1);

	const { data, error } = await query;
	if (error) throwDbError(error);
	return data || [];
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

export async function updateTask(id, updates) {
	const allowed = [
		'status',
		'assignee',
		'notes',
		'reservation_id',
		'property_id',
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
		'checklist_pdf_url',
	];
	const patch = { updated_at: now() };
	allowed.forEach((k) => {
		if (updates[k] !== undefined) patch[k] = updates[k];
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
	return getTasks({ due_date: new Date().toISOString().slice(0, 10) });
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
	if (filters.property_id) query = query.eq('property_id', filters.property_id);
	if (filters.category) query = query.eq('category', filters.category);
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
	return data;
}

export async function saveBankConnection(state) {
	const supabase = getSupabase();
	const record = {
		id: 'default',
		access_token: state.accessToken,
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
	return data;
}

export async function upsertBankTransactions(transactions) {
	if (!transactions?.length) return [];
	const supabase = getSupabase();
	const ts = now();
	const records = transactions.map((tx) => ({
		id: tx.id,
		external_id: tx.externalId,
		source: tx.source || 'plaid',
		date: tx.date,
		description: tx.description,
		amount: tx.amount,
		account: tx.account || null,
		account_id: tx.accountId || null,
		pending: Boolean(tx.pending),
		category: tx.category || '',
		property_id: tx.propertyId || null,
		updated_at: ts,
	}));

	const { data, error } = await supabase
		.from('bank_transactions')
		.upsert(records, { onConflict: 'external_id' })
		.select();
	if (error) throwDbError(error);
	return data || [];
}

export async function getBankTransactions(filters = {}) {
	const supabase = getSupabase();
	let query = supabase.from('bank_transactions').select('*');
	if (filters.date_from) query = query.gte('date', filters.date_from);
	if (filters.date_to) query = query.lte('date', filters.date_to);
	if (filters.account_id) query = query.eq('account_id', filters.account_id);
	query = query.order('date', { ascending: false });

	const limit = filters.limit ?? 2000;
	const offset = filters.offset ?? 0;
	query = query.range(offset, offset + limit - 1);

	const { data, error } = await query;
	if (error) throwDbError(error);
	return data || [];
}
