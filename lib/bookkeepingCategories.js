/**
 * Hello Neighbor property-management chart of accounts.
 *
 * User-facing labels use the names below. Legacy stored values (e.g. "Rents",
 * Schedule E–style names) are mapped via LEGACY_CATEGORY_LABELS for display,
 * filtering, search, and reporting — stored values are not rewritten.
 */

export const BOOKKEEPING_INCOME_CATEGORIES = [
	'Rental Income',
	'Pet Fee Income',
	'Guest Service Fee Income',
];

export const BOOKKEEPING_EXPENSE_CATEGORIES = [
	'Rent Expense',
	'Cleaning Expense',
	'Utilities Expense',
	'Advertising Expense',
	'Supplies Expense',
	'Property Management Fees',
	'Other Operating Expenses',
];

/** Flat list — income first, then expenses. */
export const BOOKKEEPING_CATEGORIES = [
	...BOOKKEEPING_INCOME_CATEGORIES,
	...BOOKKEEPING_EXPENSE_CATEGORIES,
];

export const BOOKKEEPING_CATEGORY_GROUPS = [
	{ label: 'Income', type: 'income', categories: BOOKKEEPING_INCOME_CATEGORIES },
	{ label: 'Expenses', type: 'expense', categories: BOOKKEEPING_EXPENSE_CATEGORIES },
];

/**
 * Legacy stored values → current report/display label.
 * Multiple legacy keys may map to the same report category (aggregated together).
 */
export const LEGACY_CATEGORY_LABELS = {
	// Income
	Rents: 'Rental Income',
	// Expenses — prior Schedule E / short names
	Advertising: 'Advertising Expense',
	'Auto & Travel': 'Other Operating Expenses',
	'Cleaning & Maintenance': 'Cleaning Expense',
	Cleaning: 'Cleaning Expense',
	Commissions: 'Property Management Fees',
	'Platform Fees': 'Property Management Fees',
	Insurance: 'Other Operating Expenses',
	'Legal & Professional': 'Other Operating Expenses',
	'Licenses & Permits': 'Other Operating Expenses',
	'Mortgage Interest': 'Other Operating Expenses',
	'Office Expenses': 'Other Operating Expenses',
	Other: 'Other Operating Expenses',
	Repairs: 'Other Operating Expenses',
	Maintenance: 'Other Operating Expenses',
	Marketing: 'Advertising Expense',
	Photography: 'Other Operating Expenses',
	'Professional Services': 'Other Operating Expenses',
	Furnishings: 'Other Operating Expenses',
	Travel: 'Other Operating Expenses',
	Software: 'Other Operating Expenses',
	Supplies: 'Supplies Expense',
	Taxes: 'Other Operating Expenses',
	Utilities: 'Utilities Expense',
};

const INCOME_SET = new Set(BOOKKEEPING_INCOME_CATEGORIES);
const EXPENSE_SET = new Set(BOOKKEEPING_EXPENSE_CATEGORIES);

/** Map legacy category names to the current label. */
export function normalizeCategory(category) {
	const value = category?.trim();
	if (!value) return '';
	return LEGACY_CATEGORY_LABELS[value] || value;
}

/** User-facing label (alias for normalizeCategory). */
export function categoryLabel(value) {
	return normalizeCategory(value);
}

/** Values to match when filtering (includes legacy aliases for the same category). */
export function categoryFilterValues(category) {
	const normalized = normalizeCategory(category);
	if (!normalized) return [];
	const values = new Set([normalized]);
	for (const [legacy, current] of Object.entries(LEGACY_CATEGORY_LABELS)) {
		if (current === normalized) values.add(legacy);
	}
	return [...values];
}

/** @returns {'income' | 'expense' | null} */
export function getCategoryType(category) {
	const value = normalizeCategory(category);
	if (!value) return null;
	if (INCOME_SET.has(value)) return 'income';
	if (EXPENSE_SET.has(value)) return 'expense';
	return null;
}

export function categoryTypeLabel(type) {
	if (type === 'income') return 'Income';
	if (type === 'expense') return 'Expense';
	return '';
}

export function isUncategorized(category) {
	return !category?.trim();
}

/**
 * Sum amounts by normalized report category (legacy + current names aggregate together).
 * @param {Array<Record<string, unknown>>} items
 * @param {{ categoryKey?: string, amountKey?: string }} opts
 */
export function aggregateAmountsByReportCategory(items, { categoryKey = 'category', amountKey = 'amount' } = {}) {
	const totals = {};
	for (const item of items) {
		const raw = item[categoryKey];
		if (!raw || !String(raw).trim()) continue;
		const label = normalizeCategory(String(raw));
		totals[label] = (totals[label] || 0) + Number(item[amountKey] || 0);
	}
	return totals;
}

/** Default income category for rental revenue / deposit auto-categorization. */
export const DEFAULT_RENTAL_INCOME_CATEGORY = 'Rental Income';
