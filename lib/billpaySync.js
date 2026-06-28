import { upsertBillpayInvoiceForTask, deleteBillpayInvoiceForTask } from './billpayDb.js';

/** Create or refresh a Billpay invoice (with PDF) when a cleaning task is completed. */
export async function syncBillpayForTaskUpdate(previousTask, updatedTask) {
	if (!updatedTask?.id) return null;

	if (updatedTask.status === 'completed') {
		try {
			return await upsertBillpayInvoiceForTask(updatedTask);
		} catch (err) {
			console.error('Billpay invoice sync failed:', err.message);
			return null;
		}
	}

	if (previousTask?.status === 'completed' && updatedTask.status !== 'completed') {
		try {
			await deleteBillpayInvoiceForTask(updatedTask.id);
		} catch (err) {
			console.error('Billpay invoice delete failed:', err.message);
		}
	}

	return null;
}
