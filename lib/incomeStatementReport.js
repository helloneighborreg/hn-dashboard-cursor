import {
	addMonths,
	endOfMonth,
	format,
	parseISO,
	startOfMonth,
} from 'date-fns';
import { normalizeCategory } from './bookkeepingCategories';
import { REPORT_BUCKETS, classifyCashItem } from './reportClassify';
import { formatReportSubtitle } from './reportDatePresets';

/** Report line structure — maps normalized categories to display rows. */
const INCOME_STRUCTURE = [
	{
		id: 'rental_income',
		label: 'Rental Income',
		lines: [
			{ id: 'rents', label: 'Rents', categories: ['Rental Income'] },
			{ id: 'pet_fees', label: 'Pet Fees & Upsells', categories: ['Pet Fee Income'] },
			{ id: 'guest_fees', label: 'Cleaning & Other Upsells', categories: ['Guest Service Fee Income'] },
		],
		subtotal: 'Total Rental Income',
	},
	{
		id: 'other_income',
		label: 'Other Income',
		lines: [
			{ id: 'general_income', label: 'General Income', categories: ['__other_income__'] },
		],
		subtotal: 'Total Other Income',
	},
];

const OPERATING_EXPENSE_STRUCTURE = [
	{
		id: 'admin',
		label: 'General Admin & Other',
		lines: [
			{ id: 'advertising', label: 'Advertising', categories: ['Advertising Expense'] },
			{ id: 'admin_other', label: 'General Admin & Other', categories: ['Other Operating Expenses', 'Rent Expense'] },
		],
		subtotal: 'Total Admin & Other',
	},
	{
		id: 'management',
		label: 'Property Management',
		lines: [
			{ id: 'mgmt_fees', label: 'Property Management Fees', categories: ['Property Management Fees'] },
		],
		subtotal: 'Total Management Fees',
	},
	{
		id: 'repairs',
		label: 'Repairs & Maintenance',
		lines: [
			{ id: 'cleaning', label: 'Cleaning & Janitorial', categories: ['Cleaning Expense'] },
			{ id: 'supplies', label: 'R&M Supplies', categories: ['Supplies Expense'] },
			{ id: 'utilities', label: 'Utilities', categories: ['Utilities Expense'] },
		],
		subtotal: 'Total Repairs & Maintenance',
	},
];

const MORTGAGE_LINES = [
	{ id: 'mortgage_payment', label: 'Mortgage Payment', match: 'payment' },
	{ id: 'mortgage_interest', label: 'Interest', match: 'interest' },
	{ id: 'mortgage_principal', label: 'Principal', match: 'principal' },
];

function monthKey(dateStr) {
	return dateStr?.slice(0, 7) || '';
}

function emptyValues(periods) {
	const values = { total: 0 };
	for (const p of periods) values[p.key] = 0;
	return values;
}

function addToValues(values, periodKey, amount) {
	values[periodKey] = (values[periodKey] || 0) + amount;
	values.total = (values.total || 0) + amount;
}

function sumValues(target, source) {
	for (const [key, val] of Object.entries(source)) {
		target[key] = (target[key] || 0) + val;
	}
}

function mortgageLineId(description) {
	const d = (description || '').toLowerCase();
	if (/interest/.test(d)) return 'mortgage_interest';
	if (/principal/.test(d)) return 'mortgage_principal';
	return 'mortgage_payment';
}

function capexLineId(category, description) {
	const label = normalizeCategory(category) || (description || 'Capital Expense');
	return `capex:${label}`;
}

/** Build month or quarter period columns covering [date_from, date_to]. */
export function buildReportPeriods(dateFrom, dateTo, interval = 'month') {
	if (!dateFrom || !dateTo) return [];

	const start = startOfMonth(parseISO(dateFrom));
	const end = endOfMonth(parseISO(dateTo));
	const periods = [];

	if (interval === 'quarter') {
		let cursor = start;
		while (cursor <= end) {
			const q = Math.floor(cursor.getMonth() / 3) + 1;
			const key = `${cursor.getFullYear()}-Q${q}`;
			const label = `Q${q} ${format(cursor, 'yy')}`;
			if (!periods.some((p) => p.key === key)) {
				periods.push({ key, label });
			}
			cursor = addMonths(cursor, 3);
		}
		return periods;
	}

	let cursor = start;
	while (cursor <= end) {
		const key = format(cursor, 'yyyy-MM');
		periods.push({ key, label: format(cursor, 'MM-yy') });
		cursor = addMonths(cursor, 1);
	}
	return periods;
}

export function periodKeyForDate(dateStr, interval) {
	if (!dateStr) return '';
	if (interval === 'quarter') {
		const d = parseISO(dateStr.slice(0, 10));
		const q = Math.floor(d.getMonth() / 3) + 1;
		return `${d.getFullYear()}-Q${q}`;
	}
	return monthKey(dateStr);
}

export function classifyLineItem(item) {
	const bucket = item.bucket || classifyCashItem(item);
	const category = normalizeCategory(item.category) || '';
	const amount = Number(item.amount) || 0;

	if (bucket === REPORT_BUCKETS.UNCATEGORIZED) {
		return { bucket, lineId: 'uncategorized', amount };
	}
	if (bucket === REPORT_BUCKETS.TRANSFER) {
		return { bucket, lineId: 'transfer', amount };
	}
	if (bucket === REPORT_BUCKETS.MORTGAGE_LOAN) {
		return { bucket, lineId: mortgageLineId(item.description), amount: Math.abs(amount) };
	}
	if (bucket === REPORT_BUCKETS.CAPEX) {
		return { bucket, lineId: capexLineId(item.category, item.description), amount: Math.abs(amount) };
	}

	if (bucket === REPORT_BUCKETS.OPERATING_INCOME) {
		for (const section of INCOME_STRUCTURE) {
			for (const line of section.lines) {
				if (line.categories.includes('__other_income__')) continue;
				if (line.categories.includes(category)) {
					return { bucket, lineId: line.id, amount };
				}
			}
		}
		return { bucket, lineId: 'general_income', amount };
	}

	if (bucket === REPORT_BUCKETS.OPERATING_EXPENSE) {
		for (const section of OPERATING_EXPENSE_STRUCTURE) {
			for (const line of section.lines) {
				if (line.categories.includes(category)) {
					return { bucket, lineId: line.id, amount: Math.abs(amount) };
				}
			}
		}
		return { bucket, lineId: 'admin_other', amount: Math.abs(amount) };
	}

	return { bucket, lineId: 'uncategorized', amount };
}

function aggregateByLine(cashItems, periods, interval) {
	const totals = {};
	for (const item of cashItems) {
		const periodKey = periodKeyForDate(item.date, interval);
		if (!periodKey) continue;
		const { lineId, amount } = classifyLineItem(item);
		if (!totals[lineId]) totals[lineId] = emptyValues(periods);
		addToValues(totals[lineId], periodKey, amount);
	}
	return totals;
}

function lineRow(id, label, values, { indent = 0, style = 'line' } = {}) {
	return { id, type: 'line', label, values, indent, style };
}

function totalRow(id, label, values, style = 'subtotal') {
	return { id, type: 'total', label, values, style };
}

function sectionRow(id, label) {
	return { id, type: 'section', label };
}

function subsectionRow(id, label) {
	return { id, type: 'subsection', label };
}

function highlightRow(id, label, values, style) {
	return { id, type: 'highlight', label, values, style };
}

function valuesForLines(lineIds, lineTotals, periods) {
	const values = emptyValues(periods);
	for (const id of lineIds) {
		if (lineTotals[id]) sumValues(values, lineTotals[id]);
	}
	return values;
}

function hasAmounts(values) {
	return (values?.total || 0) !== 0;
}

function buildIncomeRows(lineTotals, periods, { categoryLevel }) {
	const rows = [];
	const rentalLineIds = INCOME_STRUCTURE[0].lines.map((l) => l.id);
	const otherLineIds = INCOME_STRUCTURE[1].lines.map((l) => l.id);
	const allIncomeLineIds = [...rentalLineIds, ...otherLineIds];

	rows.push(sectionRow('income', 'INCOME'));

	if (categoryLevel === 'subcategory') {
		for (const section of INCOME_STRUCTURE) {
			const activeLines = section.lines.filter((line) =>
				hasAmounts(lineTotals[line.id] || emptyValues(periods)),
			);
			if (!activeLines.length) continue;

			rows.push(subsectionRow(section.id, section.label));
			for (const line of activeLines) {
				const values = lineTotals[line.id] || emptyValues(periods);
				rows.push(lineRow(line.id, line.label, values, { indent: 2 }));
			}
			const sectionLineIds = section.lines.map((l) => l.id);
			rows.push(totalRow(
				`${section.id}_subtotal`,
				section.subtotal,
				valuesForLines(sectionLineIds, lineTotals, periods),
			));
		}
	} else {
		for (const line of INCOME_STRUCTURE.flatMap((s) => s.lines)) {
			const values = lineTotals[line.id] || emptyValues(periods);
			if (hasAmounts(values)) {
				rows.push(lineRow(line.id, line.label, values, { indent: 1 }));
			}
		}
	}

	rows.push(totalRow(
		'total_income',
		'Total Income $',
		valuesForLines(allIncomeLineIds, lineTotals, periods),
		'section_total',
	));

	return { rows, incomeValues: valuesForLines(allIncomeLineIds, lineTotals, periods) };
}

function buildExpenseRows(lineTotals, periods, { categoryLevel }) {
	const rows = [];
	const allExpenseLineIds = OPERATING_EXPENSE_STRUCTURE.flatMap((s) => s.lines.map((l) => l.id));

	rows.push(sectionRow('operating_expenses', 'OPERATING EXPENSES'));

	if (categoryLevel === 'subcategory') {
		for (const section of OPERATING_EXPENSE_STRUCTURE) {
			const activeLines = section.lines.filter((line) =>
				hasAmounts(lineTotals[line.id] || emptyValues(periods)),
			);
			if (!activeLines.length) continue;

			rows.push(subsectionRow(section.id, section.label));
			for (const line of activeLines) {
				const values = lineTotals[line.id] || emptyValues(periods);
				rows.push(lineRow(line.id, line.label, values, { indent: 2 }));
			}
			const sectionLineIds = section.lines.map((l) => l.id);
			rows.push(totalRow(
				`${section.id}_subtotal`,
				section.subtotal,
				valuesForLines(sectionLineIds, lineTotals, periods),
			));
		}
	} else {
		for (const line of OPERATING_EXPENSE_STRUCTURE.flatMap((s) => s.lines)) {
			const values = lineTotals[line.id] || emptyValues(periods);
			if (hasAmounts(values)) {
				rows.push(lineRow(line.id, line.label, values, { indent: 1 }));
			}
		}
	}

	rows.push(totalRow(
		'total_operating_expenses',
		'Total Operating Expenses $',
		valuesForLines(allExpenseLineIds, lineTotals, periods),
		'section_total',
	));

	return {
		rows,
		expenseValues: valuesForLines(allExpenseLineIds, lineTotals, periods),
	};
}

function subtractValues(incomeValues, expenseValues, periods) {
	const values = emptyValues(periods);
	for (const p of periods) {
		values[p.key] = (incomeValues[p.key] || 0) - (expenseValues[p.key] || 0);
	}
	values.total = (incomeValues.total || 0) - (expenseValues.total || 0);
	return values;
}

function buildMortgageRows(lineTotals, periods) {
	const rows = [];
	const lineIds = MORTGAGE_LINES.map((l) => l.id);
	const hasData = lineIds.some((id) => (lineTotals[id]?.total || 0) !== 0);
	if (!hasData) return { rows, values: emptyValues(periods) };

	rows.push(sectionRow('mortgage', 'MORTGAGE & LOAN EXPENSES'));
	for (const line of MORTGAGE_LINES) {
		const values = lineTotals[line.id] || emptyValues(periods);
		if (values.total !== 0) {
			rows.push(lineRow(line.id, line.label, values, { indent: 1 }));
		}
	}
	const totalValues = valuesForLines(lineIds, lineTotals, periods);
	rows.push(totalRow('total_mortgage', 'Total Mortgages & Loans $', totalValues, 'section_total'));
	return { rows, values: totalValues };
}

function buildCapexRows(lineTotals, periods) {
	const capexKeys = Object.keys(lineTotals).filter((k) => k.startsWith('capex:'));
	if (!capexKeys.length) return { rows: [], values: emptyValues(periods) };

	const rows = [sectionRow('capex', 'CAPITAL EXPENSES')];
	for (const key of capexKeys.sort()) {
		const label = key.slice(6);
		rows.push(lineRow(key, label, lineTotals[key], { indent: 1 }));
	}
	const totalValues = emptyValues(periods);
	for (const key of capexKeys) sumValues(totalValues, lineTotals[key]);
	rows.push(totalRow('total_capex', 'Total Capital Expenses $', totalValues, 'section_total'));
	return { rows, values: totalValues };
}

/**
 * @param {object} opts
 * @param {Array} opts.cashItems
 * @param {string} opts.reportId - 'noi' | 'net-cash-flow'
 * @param {string} opts.propertyLabel
 * @param {string} opts.date_from
 * @param {string} opts.date_to
 * @param {string} [opts.interval]
 * @param {string} [opts.category_level]
 * @param {Array} [opts.drilldown_items]
 */
export function buildIncomeStatementReport({
	cashItems,
	reportId,
	propertyLabel,
	date_from,
	date_to,
	interval = 'month',
	category_level = 'subcategory',
	drilldown_items = [],
}) {
	const periods = buildReportPeriods(date_from, date_to, interval);
	const lineTotals = aggregateByLine(cashItems, periods, interval);
	const categoryLevel = category_level === 'category' ? 'category' : 'subcategory';

	const { rows: incomeRows, incomeValues } = buildIncomeRows(lineTotals, periods, { categoryLevel });
	const { rows: expenseRows, expenseValues } = buildExpenseRows(lineTotals, periods, { categoryLevel });
	const noiValues = subtractValues(incomeValues, expenseValues, periods);

	const rows = [
		...incomeRows,
		...expenseRows,
		highlightRow('noi', 'NET OPERATING INCOME', noiValues, 'noi'),
	];

	let netCashFlowValues = { ...noiValues };
	const uncategorizedValues = lineTotals.uncategorized || emptyValues(periods);

	if (reportId === 'noi' && uncategorizedValues.total !== 0) {
		rows.push(highlightRow(
			'uncategorized',
			'Uncategorized Transactions $',
			uncategorizedValues,
			'uncategorized',
		));
	}

	if (reportId === 'net-cash-flow' || reportId === 'inflow-outflow') {
		const { rows: mortgageRows, values: mortgageValues } = buildMortgageRows(lineTotals, periods);
		const { rows: capexRows, values: capexValues } = buildCapexRows(lineTotals, periods);
		rows.push(...mortgageRows, ...capexRows);

		netCashFlowValues = subtractValues(noiValues, mortgageValues, periods);
		netCashFlowValues = subtractValues(netCashFlowValues, capexValues, periods);
		rows.push(highlightRow('net_cash_flow', 'NET CASH FLOW', netCashFlowValues, 'net_cash_flow'));

		if (uncategorizedValues.total !== 0) {
			rows.push(highlightRow(
				'uncategorized',
				'Uncategorized Transactions $',
				uncategorizedValues,
				'uncategorized',
			));
		}
	}

	const reportTitle = reportId === 'noi' ? 'Net Operating Income' : 'Net Cash Flow';

	return {
		report: reportId,
		title: `${reportTitle} for ${propertyLabel}`,
		subtitle: formatReportSubtitle(date_from, date_to),
		periods,
		rows,
		summary: {
			total_income: incomeValues.total,
			total_operating_expenses: expenseValues.total,
			noi: noiValues.total,
			net_cash_flow: netCashFlowValues.total,
			uncategorized: uncategorizedValues.total,
		},
		filters: { date_from, date_to, interval, category_level },
		drilldown_items,
	};
}
