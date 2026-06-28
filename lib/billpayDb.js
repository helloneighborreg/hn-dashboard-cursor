import { getSupabase } from './supabase.js';
import { isDbConnectivityError, DB_UNREACHABLE_MESSAGE } from './db.js';
import { BILLPAY_STATUS, buildBillpayInvoiceFromTask } from './billpay.js';
import { buildBillpayInvoicePdfBytes } from './billpayInvoicePdf.js';
import { billpayInvoicePdfApiUrl, uploadBillpayInvoicePdf } from './billpayPdfStorage.js';

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

async function attachBillpayInvoicePdf(invoice) {
	if (!invoice?.id || !invoice?.task_id) return invoice;
	try {
		const pdfBytes = await buildBillpayInvoicePdfBytes(invoice);
		const storagePath = await uploadBillpayInvoicePdf(invoice.task_id, pdfBytes);
		const pdfUrl = billpayInvoicePdfApiUrl(invoice.id);
		const supabase = getSupabase();
		const { data, error } = await supabase
			.from('billpay_invoices')
			.update({
				pdf_url: pdfUrl,
				pdf_storage_path: storagePath,
				updated_at: now(),
			})
			.eq('id', invoice.id)
			.select()
			.single();
		if (error) throwDbError(error);
		return mapInvoice(data);
	} catch (err) {
		console.error('Billpay PDF generation failed:', err.message);
		return invoice;
	}
}

export async function upsertBillpayInvoiceForTask(task) {
	if (!task?.id || task.status !== 'completed') return null;
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
	return attachBillpayInvoicePdf(mapInvoice(data));
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

/** Backfill invoices for completed tasks missing from Billpay. */
export async function syncMissingBillpayInvoices() {
	const supabase = getSupabase();
	const { data: completedTasks, error: taskErr } = await supabase
		.from('tasks')
		.select('*')
		.eq('status', 'completed');
	if (taskErr) throwDbError(taskErr);

	const { data: existing, error: invErr } = await supabase
		.from('billpay_invoices')
		.select('task_id, pdf_url');
	if (invErr) throwDbError(invErr);

	const existingByTask = new Map((existing || []).map((row) => [row.task_id, row]));
	let created = 0;
	for (const task of completedTasks || []) {
		const row = existingByTask.get(task.id);
		if (row?.pdf_url) continue;
		await upsertBillpayInvoiceForTask(task);
		created += 1;
	}
	return created;
}
