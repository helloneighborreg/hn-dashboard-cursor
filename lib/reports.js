import { format, subMonths, parseISO } from 'date-fns';
import {
	getProperties,
	getReservations,
	platformLabel,
	buildPropertyMap,
	withReservationPropertyName,
} from './hospitable';
import { buildPropertyCodeToNameMap, formatPropertyNameForRow, getPropertyDisplayName, getReservationCode } from './codes';
import { parseOwnerStatementFinancials } from './hospitableFinancials';
import {
	getBankTransactions,
	getExpenses,
	getPropertyOwners,
	getOwnerStatementInclusions,
	getOwnerStatementNotes,
} from './db';
import { isConfirmedReservation } from './reservationDates';
import { ISO_DATE_FMT } from './dates';
import {
	classifyCashItem,
	REPORT_BUCKETS,
	scheduleELineForCategory,
	SCHEDULE_E_LINES,
} from './reportClassify';
import { getCategoryType } from './bookkeepingCategories';
import { buildIncomeStatementReport } from './incomeStatementReport';
import { buildDrilldownItems } from './reportDrilldown';
import { propertyScopeLabel } from './propertyGroups';
import { formatReportSubtitle } from './reportDatePresets';
import {
	buildPropertyOwnerStatement,
	enrichOwnerStatementReservation,
	extractReservationAdjustments,
	formatStatementMonthLabel,
	formatStatementPeriodLabel,
	ownerStatementTransactions,
	statementMonthInReportPeriod,
} from './ownerStatementReport';

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

function manualCashItems(expenses) {
	return (expenses || []).map((e) => {
		const type = getCategoryType(e.category);
		const abs = absAmount(e.amount);
		const amount = type === 'income' ? abs : -abs;
		return {
			source: 'manual',
			id: e.id,
			date: e.date,
			description: e.vendor || e.notes || (type === 'income' ? 'Manual income' : 'Manual expense'),
			notes: e.notes || '',
			amount,
			category: e.category,
			property_id: e.property_id,
			bucket: classifyCashItem({ category: e.category, description: e.vendor }),
		};
	});
}

function aggregateBucketTotals(items) {
	const totals = Object.fromEntries(Object.values(REPORT_BUCKETS).map((b) => [b, 0]));
	for (const item of items) {
		const bucket = item.bucket || REPORT_BUCKETS.UNCATEGORIZED;
		totals[bucket] = (totals[bucket] || 0) + item.amount;
	}
	return totals;
}

async function loadReportContext({ property_ids, date_from, date_to, property_include = 'details' }) {
	const properties = await getProperties({ include: property_include });
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
		...manualCashItems(formattedExpenses),
	];

	const reservationCodeById = {};
	for (const r of matchReservationsResult?.data || []) {
		const code = getReservationCode(r);
		if (r.id && code) reservationCodeById[r.id] = code;
	}

	const reservations = (reservationsResult?.data || [])
		.filter(isConfirmedReservation)
		.map((r) => {
			const row = withReservationPropertyName(r, propMap);
			const fin = parseOwnerStatementFinancials(r.financials);
			const guestName = r.guest
				? [r.guest.first_name, r.guest.last_name].filter(Boolean).join(' ')
				: null;
			const checkIn = r.check_in || r.arrival_date;
			const checkOut = r.check_out || r.departure_date;
			const hostServiceFee = Math.abs(fin.fees_by_label?.['Host Service Fee'] || 0);
			const cleaningFee = fin.fees_by_label?.['Cleaning Fee'] || 0;
			const accommodation = fin.fees_by_label?.Accommodation || 0;

			const adjustmentItems = extractReservationAdjustments(r, propMap).map((adj) => ({
				...adj,
				date: adj.date || checkIn,
				property_name: adj.property_name || row.property_name,
			}));

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
				adjustment_items: adjustmentItems,
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
	const ctx = await loadReportContext({
		...filters,
		property_include: 'details,user',
	});
	const selectedPropertyIds = ctx.filters.property_ids == null
		? ctx.properties.map((p) => p.id)
		: ctx.filters.property_ids;
	const propertyById = Object.fromEntries(ctx.properties.map((p) => [p.id, p]));

	const activePropertyIds = new Set(ctx.reservations.map((row) => row.property_id).filter(Boolean));
	for (const row of ctx.reservations) {
		for (const adj of row.adjustment_items || []) {
			if (row.property_id) activePropertyIds.add(row.property_id);
		}
	}
	for (const item of ctx.cashItems || []) {
		if (item.property_id && !item.matched_reservation_id) activePropertyIds.add(item.property_id);
	}

	const statementPropertyIds = selectedPropertyIds.length === 1
		? selectedPropertyIds
		: selectedPropertyIds.filter((id) => activePropertyIds.has(id));

	const ownerPropertyIds = [...new Set([
		...ctx.reservations.map((row) => row.property_id).filter(Boolean),
		...statementPropertyIds,
	])];
	const ownerRows = await getPropertyOwners(ownerPropertyIds);
	const ownerByPropertyId = Object.fromEntries(ownerRows.map((row) => [row.property_id, row]));
	const enrichedReservations = ctx.reservations.map((row) => enrichOwnerStatementReservation(row, {
		managementFeePercent: ownerByPropertyId[row.property_id]?.management_fee_percent,
	}));
	const inclusionRows = await getOwnerStatementInclusions(ownerPropertyIds);
	const inclusionByReservationId = Object.fromEntries(
		inclusionRows.map((row) => [row.reservation_id, row]),
	);
	const noteRows = await getOwnerStatementNotes(ownerPropertyIds);
	const notesByKey = Object.fromEntries(
		noteRows.map((row) => [`${row.property_id}:${row.reservation_id}`, row.notes || '']),
	);

	const reservationsWithInclusion = enrichedReservations.map((row) => {
		const inclusion = inclusionByReservationId[row.id];
		const assignedMonth = inclusion?.property_id === row.property_id
			? inclusion.statement_month
			: null;
		return {
			...row,
			owner_name: ownerByPropertyId[row.property_id]?.name || '',
			statement_month: assignedMonth,
			statement_month_label: formatStatementMonthLabel(assignedMonth),
			included_on_statement: Boolean(assignedMonth),
			statement_notes: notesByKey[`${row.property_id}:${row.id}`] || '',
		};
	});

	const includedReservations = reservationsWithInclusion.filter((row) => {
		if (!row.included_on_statement || !row.statement_month) return false;
		return statementMonthInReportPeriod(
			row.statement_month,
			ctx.filters.date_from,
			ctx.filters.date_to,
		);
	});

	const completeCount = reservationsWithInclusion.filter((row) => row.included_on_statement).length;

	const transactionsByProperty = new Map();
	for (const propertyId of selectedPropertyIds) {
		const property = propertyById[propertyId];
		if (!property) continue;
		const propertyName = getPropertyDisplayName(property) || property.name || property.public_name || '';
		const propertyReservations = reservationsWithInclusion.filter((row) => row.property_id === propertyId);
		transactionsByProperty.set(propertyId, {
			propertyName,
			propertyReservations,
			transactions: ownerStatementTransactions(
				ctx.cashItems,
				propertyId,
				propertyName,
				{ reservations: propertyReservations },
			),
		});
	}

	const statements = statementPropertyIds.map((propertyId) => {
		const property = propertyById[propertyId];
		if (!property) return null;

		const reservations = includedReservations.filter((row) => row.property_id === propertyId);
		const entry = transactionsByProperty.get(propertyId);
		const transactions = entry?.transactions || [];

		return buildPropertyOwnerStatement({
			property,
			ownerRecord: ownerByPropertyId[propertyId],
			reservations,
			transactions,
			adjustments: [],
			dateFrom: ctx.filters.date_from,
			dateTo: ctx.filters.date_to,
		});
	}).filter(Boolean);

	const aggregateTotals = statements.reduce((acc, statement) => {
		acc.total_due_to_owner += statement.totals.total_due_to_owner || 0;
		return acc;
	}, { total_due_to_owner: 0 });

	const additionalItems = selectedPropertyIds.flatMap((propertyId) => {
		const entry = transactionsByProperty.get(propertyId);
		if (!entry) return [];
		return entry.transactions.map((row) => ({
			...row,
			kind: 'transaction',
			property_name: entry.propertyName,
		}));
	}).sort((a, b) => String(a.date).localeCompare(String(b.date)));

	return {
		report: 'owner-statements',
		title: `Owner Statement - ${propertyScopeLabel(ctx.properties, ctx.filters.property_ids)}`,
		subtitle: formatReportSubtitle(ctx.filters.date_from, ctx.filters.date_to),
		statement_period: formatStatementPeriodLabel(ctx.filters.date_from, ctx.filters.date_to),
		manager: {
			name: 'Hello Neighbor Real Estate Group',
		},
		filters: ctx.filters,
		summary: {
			reservation_count: reservationsWithInclusion.length,
			complete_count: completeCount,
			incomplete_count: reservationsWithInclusion.length - completeCount,
			total_revenue: sumBy(includedReservations, (r) => r.revenue),
			total_paid_to_manager: sumBy(includedReservations, (r) => r.total_paid_to_manager),
			remaining_balance_due: sumBy(includedReservations, (r) => r.remaining_balance_due),
			total_due_to_owner: aggregateTotals.total_due_to_owner,
		},
		reservations: reservationsWithInclusion,
		statements,
		additional_items: additionalItems,
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
			throw new Error(`Unknown report: ${reportId}`);
	}
}
