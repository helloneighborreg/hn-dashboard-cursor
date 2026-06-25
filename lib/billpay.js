import { formatPropertyDisplayName } from './codes';
import { getFormSubmissionForTask } from './forms/checklistSubmissions';
import { getBaseCleaningRateForPropertyCode } from './propertyBaseCleaningRate';
import { taskHeadline } from './taskDisplay';

export const BILLPAY_STATUS = {
	PENDING: 'pending',
	COMPLETED: 'completed',
};

function parseAmount(value) {
	if (value == null || value === '') return 0;
	const n = Number(value);
	if (!Number.isFinite(n) || n < 0) return 0;
	return Math.round(n * 100) / 100;
}

/** Pull invoice line amounts from a submitted turn-clean checklist. */
export function invoiceAmountsFromSubmission(submission) {
	const answers = submission?.answers || {};
	const fromCalc = submission?.calculations?.svxB?.value;
	const base = parseAmount(answers['43sB']?.value);
	const hasAdditional = answers['kmJc']?.value === 'Yes';
	const additional = hasAdditional ? parseAmount(answers['7Mpe']?.value) : 0;
	const total = fromCalc != null ? parseAmount(fromCalc) : base + additional;

	return {
		amount: total,
		base_amount: base,
		additional_amount: additional,
		additional_description: hasAdditional ? (answers['jxUf']?.value || '').trim() || null : null,
	};
}

/** Build a billpay invoice row from a task (and optional checklist submission). */
export async function buildBillpayInvoiceFromTask(task, submission = null) {
	const checklist = submission ?? (task?.id ? await getFormSubmissionForTask(task.id) : null);
	let amounts = checklist ? invoiceAmountsFromSubmission(checklist) : null;

	if (!amounts?.amount) {
		const propertyCode = formatPropertyDisplayName(task?.property_name);
		const base = await getBaseCleaningRateForPropertyCode(propertyCode);
		amounts = {
			amount: base,
			base_amount: base,
			additional_amount: 0,
			additional_description: null,
		};
	}

	return {
		task_id: task.id,
		status: BILLPAY_STATUS.PENDING,
		payee: task.assignee?.trim() || null,
		property_id: task.property_id || null,
		property_name: task.property_name?.trim() || null,
		reservation_id: task.reservation_id || null,
		guest_name: task.guest_name?.trim() || null,
		checkout_date: task.checkout_date || task.due_date || null,
		description: taskHeadline(task) || task.title?.trim() || null,
		task_type: task.type || null,
		amount: amounts.amount,
		base_amount: amounts.base_amount,
		additional_amount: amounts.additional_amount,
		additional_description: amounts.additional_description,
		paid_at: task.paid_at || null,
		paid_by: task.paid_by?.trim() || null,
	};
}

export function billpayInvoiceTotal(invoices) {
	return (invoices || []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
}
