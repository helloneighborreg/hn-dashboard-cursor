import { format, subMonths, parseISO } from 'date-fns';
import {
	getProperties,
	getReservations,
	platformLabel,
	buildPropertyMap,
	withReservationPropertyName,
} from './hospitable';
import { buildPropertyCodeToNameMap, formatPropertyNameForRow, getReservationCode } from './codes';
import { parseHostFinancials } from './hospitableFinancials';
import { getBankTransactions, getExpenses } from './db';
import { reservationActsAsCancelled } from './reservationDates';
import { ISO_DATE_FMT } from './dates';
import {
	classifyCashItem,
	REPORT_BUCKETS,
	scheduleELineForCategory,
	SCHEDULE_E_LINES,
} from './reportClassify';
import { buildIncomeStatementReport } from './incomeStatementReport';
import { buildDrilldownItems } from './reportDrilldown';
import { propertyScopeLabel } from './propertyGroups';
import { formatReportSubtitle } from './reportDatePresets';

function absAmount(n) {
	return Math.abs(Number(n) || 0);
}

function signedAmount(n) {
	return Number(n) || 0;
}

function sumBy(items, fn) {
	return items.reduce((sum, item) => sum + fn(item), 0);
}

function filterVisibleBankRows(rows) {
	return (rows || []).filter((tx) => !tx.hidden);
}

function bankCashItems(rows) {
	return filterVisibleBankRows(rows).map((tx) => ({
		source: 'bank',
		id: tx.id,
		date: tx.date,
		description: tx.description,
		amount: signedAmount(tx.amount),
		category: tx.category,
		property_id: tx.property_id,
		matched_reservation_id: tx.matched_reservation_id,
		reservation_splits: tx.reservation_splits,
		bucket: classifyCashItem(tx),
	}));
}

function manualExpenseItems(expenses) {
	return (expenses || []).map((e) => ({
		source: 'manual',
		id: e.id,
		date: e.date,
		description: e.vendor || e.description || 'Manual expense',
		amount: -absAmount(e.amount),
		category: e.category,
		property_id: e.property_id,
		bucket: classifyCashItem({ category: e.category, description: e.vendor }),
	}));
}

function aggregateBucketTotals(items) {
	const totals = Object.fromEntries(Object.values(REPORT_BUCKETS).map((b) => [b, 0]));
	for (const item of items) {
		const bucket = item.bucket || REPORT_BUCKETS.UNCATEGORIZED;
		totals[bucket] = (totals[bucket] || 0) + item.amount;
	}
	return totals;
}

async function loadReportContext({ property_ids, date_from, date_to }) {
	const properties = await getProperties();
	const propMap = buildPropertyMap(properties);
	const codeToNameMap = buildPropertyCodeToNameMap(properties);
	const allPropertyIds = properties.map((p) => p.id);
	const selectedPropertyIds = property_ids == null
		? allPropertyIds
		: property_ids;

	const bankFilters = {
		date_from,
		date_to,
		property_ids: property_ids == null ? undefined : property_ids,
		hidden: 'false',
		limit: 5000,
	};
	const expenseFilters = {
		date_from,
		date_to,
		property_ids: property_ids == null ? undefined : property_ids,
		limit: 5000,
	};

	if (selectedPropertyIds.length === 0) {
		return {
			properties,
			propMap,
			cashItems: [],
			reservations: [],
			reservationCodeById: {},
			filters: { property_ids: [], date_from, date_to },
		};
	}

	const matchDateFrom = date_from
		? format(subMonths(parseISO(date_from), 4), ISO_DATE_FMT)
		: undefined;

	const [bankRows, manualExpenses, reservationsResult, matchReservationsResult] = await Promise.all([
		getBankTransactions(bankFilters),
		getExpenses(expenseFilters),
		getReservations(selectedPropertyIds, {
			perPage: 500,
			startDate: date_from,
			endDate: date_to,
			include: 'financials,guest',
		}),
		getReservations(selectedPropertyIds, {
			perPage: 500,
			startDate: matchDateFrom,
			endDate: date_to,
		}),
	]);

	const formattedExpenses = manualExpenses.map((e) =>
		formatPropertyNameForRow(e, codeToNameMap, propMap),
	);

	const cashItems = [
		...bankCashItems(bankRows),
		...manualExpenseItems(formattedExpenses),
	];

	const reservationCodeById = {};
	for (const r of matchReservationsResult?.data || []) {
		const code = getReservationCode(r);
		if (r.id && code) reservationCodeById[r.id] = code;
	}

	const reservations = (reservationsResult?.data || [])
		.filter((r) => !reservationActsAsCancelled(r))
		.map((r) => {
			const row = withReservationPropertyName(r, propMap);
			const fin = parseHostFinancials(r.financials?.host);
			const guestName = r.guest
				? [r.guest.first_name, r.guest.last_name].filter(Boolean).join(' ')
				: null;
			const checkIn = r.check_in || r.arrival_date;
			const checkOut = r.check_out || r.departure_date;
			const hostServiceFee = Math.abs(fin.fees_by_label?.['Host Service Fee'] || 0);
			const cleaningFee = fin.fees_by_label?.['Cleaning Fee'] || 0;
			const accommodation = fin.fees_by_label?.Accommodation || 0;

			return {
				id: r.id,
				code: r.code,
				platform: r.platform,
				platform_label: platformLabel(r.platform),
				property_id: row.property_id,
				property_name: row.property_name,
				guest_name: guestName,
				check_in: checkIn,
				check_out: checkOut,
				nights: r.nights,
				revenue: fin.revenue,
				accommodation,
				cleaning_fee: cleaningFee,
				host_service_fee: hostServiceFee,
				fees_by_label: fin.fees_by_label,
				total_paid_to_manager: r.platform === 'airbnb' ? hostServiceFee : 0,
				remaining_balance_due: Math.max(0, hostServiceFee),
				owner_payout: fin.revenue,
			};
		});

	return {
		properties,
		propMap,
		cashItems,
		reservations,
		reservationCodeById,
		filters: { property_ids: property_ids == null ? null : property_ids, date_from, date_to },
	};
}

export async function buildOwnerStatementsReport(filters) {
	const ctx = await loadReportContext(filters);
	const byProperty = {};
	for (const row of ctx.reservations) {
		byProperty[row.property_id] = byProperty[row.property_id] || {
			property_id: row.property_id,
			property_name: row.property_name,
			reservations: [],
			total_revenue: 0,
			total_paid_to_manager: 0,
			remaining_balance_due: 0,
		};
		const bucket = byProperty[row.property_id];
		bucket.reservations.push(row);
		bucket.total_revenue += row.revenue;
		bucket.total_paid_to_manager += row.total_paid_to_manager;
		bucket.remaining_balance_due += row.remaining_balance_due;
	}

	return {
		report: 'owner-statements',
		title: `Owner Statements for ${propertyScopeLabel(ctx.properties, ctx.filters.property_ids)}`,
		subtitle: formatReportSubtitle(ctx.filters.date_from, ctx.filters.date_to),
		filters: ctx.filters,
		summary: {
			reservation_count: ctx.reservations.length,
			total_revenue: sumBy(ctx.reservations, (r) => r.revenue),
			total_paid_to_manager: sumBy(ctx.reservations, (r) => r.total_paid_to_manager),
			remaining_balance_due: sumBy(ctx.reservations, (r) => r.remaining_balance_due),
		},
		by_property: Object.values(byProperty),
		reservations: ctx.reservations,
	};
}

function buildIncomeStatementFromContext(ctx, reportId, filters) {
	const propertyLabel = propertyScopeLabel(ctx.properties, ctx.filters.property_ids);

	return buildIncomeStatementReport({
		cashItems: ctx.cashItems,
		reportId,
		propertyLabel,
		date_from: filters.date_from,
		date_to: filters.date_to,
		interval: filters.interval || 'month',
		category_level: filters.category_level || 'subcategory',
		drilldown_items: buildDrilldownItems(
			ctx.cashItems,
			filters.interval || 'month',
			ctx.propMap,
			ctx.reservationCodeById,
		),
	});
}

export function buildNetCashFlowReport(filters) {
	return loadReportContext(filters).then((ctx) => ({
		...buildIncomeStatementFromContext(ctx, 'net-cash-flow', { ...ctx.filters, ...filters }),
		filters: { ...ctx.filters, interval: filters.interval, category_level: filters.category_level },
	}));
}

export function buildNoiReport(filters) {
	return loadReportContext(filters).then((ctx) => ({
		...buildIncomeStatementFromContext(ctx, 'noi', { ...ctx.filters, ...filters }),
		filters: { ...ctx.filters, interval: filters.interval, category_level: filters.category_level },
	}));
}

export function buildInflowOutflowReport(filters) {
	return loadReportContext(filters).then((ctx) => ({
		...buildIncomeStatementFromContext(ctx, 'inflow-outflow', { ...ctx.filters, ...filters }),
		filters: { ...ctx.filters, interval: filters.interval, category_level: filters.category_level },
	}));
}

export async function buildBalanceSheetReport(filters) {
	const ctx = await loadReportContext(filters);
	const allItems = ctx.cashItems;
	const totals = aggregateBucketTotals(allItems);

	const cashFromActivity = totals[REPORT_BUCKETS.OPERATING_INCOME]
		+ totals[REPORT_BUCKETS.OPERATING_EXPENSE]
		+ totals[REPORT_BUCKETS.MORTGAGE_LOAN]
		+ totals[REPORT_BUCKETS.CAPEX]
		+ totals[REPORT_BUCKETS.TRANSFER]
		+ totals[REPORT_BUCKETS.UNCATEGORIZED];

	const mortgageOutflows = Math.abs(Math.min(0, totals[REPORT_BUCKETS.MORTGAGE_LOAN] || 0));

	return {
		report: 'balance-sheet',
		title: `Balance Sheet for ${propertyScopeLabel(ctx.properties, ctx.filters.property_ids)}`,
		subtitle: formatReportSubtitle(ctx.filters.date_from, ctx.filters.date_to),
		filters: ctx.filters,
		note: 'Cash is estimated from categorized bank activity in the selected period. Full balance sheet requires asset, liability, and equity accounts not yet tracked in the dashboard.',
		assets: [
			{ label: 'Cash (estimated from bank activity)', amount: cashFromActivity },
		],
		liabilities: [
			{ label: 'Mortgage / loan payments (period outflows)', amount: mortgageOutflows },
		],
		equity: [
			{
				label: 'Retained earnings (assets − liabilities, estimated)',
				amount: cashFromActivity - mortgageOutflows,
			},
		],
		totals: {
			assets: cashFromActivity,
			liabilities: mortgageOutflows,
			equity: cashFromActivity - mortgageOutflows,
		},
	};
}

export async function buildScheduleEReport(filters) {
	const ctx = await loadReportContext(filters);
	const drilldown_items = buildDrilldownItems(
		ctx.cashItems,
		'month',
		ctx.propMap,
		ctx.reservationCodeById,
	);
	const lineTotals = new Map(SCHEDULE_E_LINES.map((e) => [e.line, { ...e, amount: 0 }]));

	for (const item of ctx.cashItems) {
		if (item.bucket === REPORT_BUCKETS.TRANSFER) continue;
		const line = scheduleELineForCategory(item.category);
		if (!line) continue;
		const entry = lineTotals.get(line.line);
		if (entry) entry.amount += item.amount;
	}

	const rows = [...lineTotals.values()].filter((r) => r.amount !== 0);
	const income = rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
	const expenses = rows.filter((r) => r.amount < 0).reduce((s, r) => s + Math.abs(r.amount), 0);

	return {
		report: 'schedule-e',
		title: `Schedule E for ${propertyScopeLabel(ctx.properties, ctx.filters.property_ids)}`,
		subtitle: formatReportSubtitle(ctx.filters.date_from, ctx.filters.date_to),
		filters: ctx.filters,
		summary: {
			total_income: income,
			total_expenses: expenses,
			net_rental_income: income - expenses,
		},
		lines: rows.sort((a, b) => a.line - b.line),
		drilldown_items,
	};
}

export async function buildReport(reportId, filters) {
	switch (reportId) {
		case 'owner-statements':
			return buildOwnerStatementsReport(filters);
		case 'net-cash-flow':
			return buildNetCashFlowReport(filters);
		case 'noi':
			return buildNoiReport(filters);
		case 'inflow-outflow':
			return buildInflowOutflowReport(filters);
		case 'balance-sheet':
			return buildBalanceSheetReport(filters);
		case 'schedule-e':
			return buildScheduleEReport(filters);
		default:
			return buildOwnerStatementsReport(filters);
	}
}
