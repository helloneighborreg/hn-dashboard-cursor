import { getCategoryType, normalizeCategory } from './bookkeepingCategories';

export const REPORT_BUCKETS = {
	OPERATING_INCOME: 'operating_income',
	OPERATING_EXPENSE: 'operating_expense',
	MORTGAGE_LOAN: 'mortgage_loan',
	CAPEX: 'capex',
	TRANSFER: 'transfer',
	UNCATEGORIZED: 'uncategorized',
};

const MORTGAGE_RE = /mortgage|loan|principal|escrow|heloc/i;
const CAPEX_RE = /capex|capital\s*expenditure|renovation|improvement|furnish|equipment|fixture/i;
const TRANSFER_RE = /transfer|xfer|internal\s*move|between\s*accounts/i;

/** IRS Schedule E line labels keyed by stored/raw category name. */
export const SCHEDULE_E_LINES = [
	{ line: 3, label: 'Rents received', keys: ['Rents', 'Rental Income'] },
	{ line: 5, label: 'Advertising', keys: ['Advertising', 'Advertising Expense', 'Marketing'] },
	{ line: 6, label: 'Auto and travel', keys: ['Auto & Travel', 'Travel'] },
	{ line: 7, label: 'Cleaning and maintenance', keys: ['Cleaning & Maintenance', 'Cleaning', 'Cleaning Expense', 'Maintenance'] },
	{ line: 8, label: 'Commissions', keys: ['Commissions', 'Platform Fees', 'Property Management Fees'] },
	{ line: 9, label: 'Insurance', keys: ['Insurance'] },
	{ line: 10, label: 'Legal and other professional fees', keys: ['Legal & Professional', 'Professional Services'] },
	{ line: 11, label: 'Management fees', keys: ['Property Management Fees'] },
	{ line: 12, label: 'Mortgage interest paid to banks, etc.', keys: ['Mortgage Interest'] },
	{ line: 14, label: 'Repairs', keys: ['Repairs'] },
	{ line: 15, label: 'Supplies', keys: ['Supplies', 'Supplies Expense'] },
	{ line: 16, label: 'Taxes', keys: ['Taxes', 'Lodging Taxes'] },
	{ line: 17, label: 'Utilities', keys: ['Utilities', 'Utilities Expense'] },
	{ line: 18, label: 'Depreciation expense or depletion', keys: ['Depreciation'] },
	{ line: 19, label: 'Other', keys: ['Other', 'Other Operating Expenses', 'Rent Expense', 'Software', 'Photography', 'Furnishings', 'Licenses & Permits', 'Office Expenses'] },
];

const scheduleEKeyToLine = (() => {
	const map = new Map();
	for (const entry of SCHEDULE_E_LINES) {
		for (const key of entry.keys) {
			map.set(key.toLowerCase(), entry);
		}
	}
	return map;
})();

export function scheduleELineForCategory(category) {
	const raw = (category || '').trim();
	if (!raw) return null;
	const direct = scheduleEKeyToLine.get(raw.toLowerCase());
	if (direct) return direct;
	const normalized = normalizeCategory(raw);
	return scheduleEKeyToLine.get(normalized.toLowerCase()) || SCHEDULE_E_LINES.find((e) => e.line === 19);
}

export function classifyCashItem({ category, description } = {}) {
	const raw = (category || '').trim();
	const desc = (description || '').toLowerCase();
	const type = getCategoryType(raw);

	if (!raw) {
		if (TRANSFER_RE.test(desc)) return REPORT_BUCKETS.TRANSFER;
		if (MORTGAGE_RE.test(desc)) return REPORT_BUCKETS.MORTGAGE_LOAN;
		if (CAPEX_RE.test(desc)) return REPORT_BUCKETS.CAPEX;
		return REPORT_BUCKETS.UNCATEGORIZED;
	}

	if (type === 'income') return REPORT_BUCKETS.OPERATING_INCOME;
	if (type === 'expense') return REPORT_BUCKETS.OPERATING_EXPENSE;

	if (TRANSFER_RE.test(raw) || TRANSFER_RE.test(desc)) return REPORT_BUCKETS.TRANSFER;
	if (MORTGAGE_RE.test(raw) || MORTGAGE_RE.test(desc)) return REPORT_BUCKETS.MORTGAGE_LOAN;
	if (CAPEX_RE.test(raw) || CAPEX_RE.test(desc)) return REPORT_BUCKETS.CAPEX;

	return REPORT_BUCKETS.UNCATEGORIZED;
}

export function isInflowAmount(amount) {
	return Number(amount) > 0;
}
