import { getSupabase } from './supabase.js';
import { isDbConnectivityError, DB_UNREACHABLE_MESSAGE } from './db.js';
import { BILLPAY_STATUS, buildBillpayInvoiceFromTask } from './billpay.js';

function throwDbError(error) {
	if (isDbConnectivityError(error)) {
		throw new Error(DB_UNREACHABLE_MESSAGE);
	}
	if (error?.code === 'PGRST205' && /billpay_invoices/i.test(String(error?.message || ''))) {
		throw new Error(
			'Billpay tables missing. In Supabase → SQL Editor, run supabase/migrations/20260705_billpay_invoices.sql',
		);
	}
	throw error?.message ? new Error(error.message) : error;
}

function now() {
	return new Date().toISOString();
}

function mapInvoice(row) {
	if (!row) return row;
	return {
		...row,
		amount: Number(row.amount ?? 0),
		base_amount: Number(row.base_amount ?? 0),
		additional_amount: Number(row.additional_amount ?? 0),
	};
}

export async function getBillpayInvoices({ status } = {}) {
	const supabase = getSupabase();
	let query = supabase
		.from('billpay_invoices')
		.select('*')
		.order('checkout_date', { ascending: false, nullsFirst: false })
		.order('created_at', { ascending: false });
	if (status) query = query.eq('status', status);
	const { data, error } = await query;
	if (error) throwDbError(error);
	return (data || []).map(mapInvoice);
}

export async function getBillpayInvoiceByTaskId(taskId) {
	if (!taskId) return null;
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('billpay_invoices')
		.select('*')
		.eq('task_id', taskId)
		.maybeSingle();
	if (error) throwDbError(error);
	return mapInvoice(data);
}

export async function getBillpayInvoiceById(id) {
	if (!id) return null;
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('billpay_invoices')
		.select('*')
		.eq('id', id)
		.maybeSingle();
	if (error) throwDbError(error);
	return mapInvoice(data);
}

export async function upsertBillpayInvoiceForTask(task) {
	if (!task?.id || !task?.paid_at) return null;
	const payload = await buildBillpayInvoiceFromTask(task);
	const existing = await getBillpayInvoiceByTaskId(task.id);
	const record = { ...payload, updated_at: now() };
	if (existing?.status === BILLPAY_STATUS.COMPLETED) {
		delete record.status;
	}

	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('billpay_invoices')
		.upsert(record, { onConflict: 'task_id' })
		.select()
		.single();
	if (error) throwDbError(error);
	return mapInvoice(data);
}

export async function deleteBillpayInvoiceForTask(taskId) {
	if (!taskId) return;
	const supabase = getSupabase();
	const { error } = await supabase.from('billpay_invoices').delete().eq('task_id', taskId);
	if (error) throwDbError(error);
}

export async function completeBillpayInvoice(id, completedBy) {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('billpay_invoices')
		.update({
			status: BILLPAY_STATUS.COMPLETED,
			completed_at: now(),
			completed_by: completedBy || null,
			updated_at: now(),
		})
		.eq('id', id)
		.eq('status', BILLPAY_STATUS.PENDING)
		.select()
		.maybeSingle();
	if (error) throwDbError(error);
	return mapInvoice(data);
}

export async function reopenBillpayInvoice(id) {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('billpay_invoices')
		.update({
			status: BILLPAY_STATUS.PENDING,
			completed_at: null,
			completed_by: null,
			updated_at: now(),
		})
		.eq('id', id)
		.eq('status', BILLPAY_STATUS.COMPLETED)
		.select()
		.maybeSingle();
	if (error) throwDbError(error);
	return mapInvoice(data);
}

/** Backfill invoices for tasks already marked paid before billpay existed. */
export async function syncMissingBillpayInvoices() {
	const supabase = getSupabase();
	const { data: paidTasks, error: taskErr } = await supabase
		.from('tasks')
		.select('*')
		.not('paid_at', 'is', null);
	if (taskErr) throwDbError(taskErr);

	const { data: existing, error: invErr } = await supabase
		.from('billpay_invoices')
		.select('task_id');
	if (invErr) throwDbError(invErr);

	const existingIds = new Set((existing || []).map((row) => row.task_id));
	let created = 0;
	for (const task of paidTasks || []) {
		if (existingIds.has(task.id)) continue;
		await upsertBillpayInvoiceForTask(task);
		created += 1;
	}
	return created;
}
