/**
 * Tasks and expenses stored in Supabase Postgres.
 * API routes are already protected by iron-session; use SUPABASE_SERVICE_ROLE_KEY server-side only.
 */

import { getSupabase } from './supabase';

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

async function findExistingTaskForReservation(task) {
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

	if (task.property_id && task.checkout_date) {
		const { data: rows, error: rowErr } = await supabase
			.from('tasks')
			.select('*')
			.eq('property_id', task.property_id)
			.eq('checkout_date', task.checkout_date)
			.eq('type', 'turnover');
		if (rowErr) throwDbError(rowErr);
		if (rows?.length === 1) return rows[0];
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
		return { task: data, isNew: false };
	}

	const { hospitable_reservation_id: _legacy, ...record } = task;
	const created = await createTask({
		...record,
		status: 'unassigned',
		assignee: null,
	});
	return { task: created, isNew: true };
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

	const ascending = Boolean(filters.unassigned);
	query = query.order('due_date', { ascending }).order('due_time', { ascending });

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
