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

function sortTasks(tasks) {
	return tasks.sort((a, b) =>
		a.due_date !== b.due_date
			? String(a.due_date).localeCompare(String(b.due_date))
			: (a.due_time || '').localeCompare(b.due_time || ''),
	);
}

function sortExpenses(expenses) {
	return expenses.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function applyTaskFilters(tasks, filters) {
	let result = [...tasks];
	if (filters.property_id) result = result.filter((t) => t.property_id === filters.property_id);
	if (filters.status) result = result.filter((t) => t.status === filters.status);
	if (filters.assignee) result = result.filter((t) => t.assignee === filters.assignee);
	if (filters.due_date) result = result.filter((t) => t.due_date === filters.due_date);
	if (filters.date_from) result = result.filter((t) => t.due_date >= filters.date_from);
	if (filters.date_to) result = result.filter((t) => t.due_date <= filters.date_to);
	if (filters.type) result = result.filter((t) => t.type === filters.type);
	return sortTasks(result);
}

function applyExpenseFilters(expenses, filters) {
	let result = [...expenses];
	if (filters.property_id) result = result.filter((e) => e.property_id === filters.property_id);
	if (filters.date_from) result = result.filter((e) => e.date >= filters.date_from);
	if (filters.date_to) result = result.filter((e) => e.date <= filters.date_to);
	if (filters.category) result = result.filter((e) => e.category === filters.category);
	return sortExpenses(result);
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

export async function upsertTurnoverTask(task) {
	const supabase = getSupabase();
	const { data: existing, error: findErr } = await supabase
		.from('tasks')
		.select('*')
		.eq('reservation_id', task.reservation_id)
		.eq('type', 'turnover')
		.maybeSingle();
	if (findErr) throwDbError(findErr);
	if (existing) return { task: existing, isNew: false };
	const created = await createTask(task);
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

	const { data, error } = await query;
	if (error) throwDbError(error);
	return applyTaskFilters(data || [], filters);
}

export async function getTaskById(id) {
	const supabase = getSupabase();
	const { data, error } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle();
	if (error) throwDbError(error);
	return data;
}

export async function updateTask(id, updates) {
	const allowed = ['status', 'assignee', 'notes', 'due_date', 'due_time', 'title', 'description'];
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

	const { data, error } = await query;
	if (error) throwDbError(error);
	return applyExpenseFilters(data || [], filters);
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
