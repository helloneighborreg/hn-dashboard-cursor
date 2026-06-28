import { CHECKLIST_UPLOADS_BUCKET, getChecklistUploadPublicUrl } from './forms/checklistFormStorage.js';
import { getSupabase } from './supabase.js';

export function billpayInvoiceStoragePath(taskId) {
	return `billpay/${taskId}/invoice.pdf`;
}

export function billpayInvoicePdfApiUrl(invoiceId) {
	return `/api/billpay/${invoiceId}/pdf`;
}

export async function uploadBillpayInvoicePdf(taskId, pdfBytes) {
	if (!taskId) throw new Error('Task id is required');
	const storagePath = billpayInvoiceStoragePath(taskId);
	const bytes = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
	const supabase = getSupabase();
	const { error } = await supabase.storage
		.from(CHECKLIST_UPLOADS_BUCKET)
		.upload(storagePath, bytes, { contentType: 'application/pdf', upsert: true });
	if (error) throw error;
	return storagePath;
}

export function getBillpayInvoicePdfPublicUrl(storagePath) {
	return getChecklistUploadPublicUrl(storagePath);
}
