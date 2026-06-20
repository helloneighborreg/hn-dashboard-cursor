import { normalizeCategory } from './bookkeepingCategories';
import {
	classifyLineItem,
	periodKeyForDate,
} from './incomeStatementReport';
import { scheduleELineForCategory } from './reportClassify';
import { getReservationSplits } from './reservationSplits';

const INCOME_LINE_IDS = ['rents', 'pet_fees', 'guest_fees', 'general_income'];
const EXPENSE_LINE_IDS = [
	'advertising', 'admin_other', 'mgmt_fees', 'cleaning', 'supplies', 'utilities',
];
const MORTGAGE_LINE_IDS = ['mortgage_payment', 'mortgage_interest', 'mortgage_principal'];

const ROW_LINE_IDS = {
	rental_income_subtotal: ['rents', 'pet_fees', 'guest_fees'],
	other_income_subtotal: ['general_income'],
	admin_subtotal: ['advertising', 'admin_other'],
	management_subtotal: ['mgmt_fees'],
	repairs_subtotal: ['cleaning', 'supplies', 'utilities'],
	total_income: INCOME_LINE_IDS,
	total_operating_expenses: EXPENSE_LINE_IDS,
	total_mortgage: MORTGAGE_LINE_IDS,
	noi: [...INCOME_LINE_IDS, ...EXPENSE_LINE_IDS],
	uncategorized: ['uncategorized'],
	transfer: ['transfer'],
};

function propertyName(propMap, propertyId) {
	if (!propertyId || !propMap[propertyId]) return '';
	const p = propMap[propertyId];
	return p.name || p.public_name || '';
}

export function buildDrilldownItems(cashItems, interval, propMap = {}, reservationCodeById = {}) {
	return (cashItems || []).map((item) => {
		const { lineId, amount: reportAmount } = classifyLineItem(item);
		const scheduleLine = scheduleELineForCategory(item.category);
		const splits = getReservationSplits(item);
		const reservationCodes = splits.length
			? splits.map((s) => reservationCodeById[s.reservation_id]).filter(Boolean)
			: (item.matched_reservation_id
				? [reservationCodeById[item.matched_reservation_id]].filter(Boolean)
				: []);
		const reservationCode = reservationCodes.length
			? reservationCodes.join(', ')
			: null;
		return {
			id: item.id,
			source: item.source,
			date: item.date,
			description: item.description,
			category: normalizeCategory(item.category) || item.category || '',
			property_id: item.property_id,
			property_name: propertyName(propMap, item.property_id),
			reservation_code: reservationCode,
			amount: item.amount,
			reportAmount,
			lineId,
			periodKey: periodKeyForDate(item.date, interval),
			schedule_line: scheduleLine?.line ?? null,
		};
	});
}

export function getLineIdsForRow(rowId, allLineIds = []) {
	if (ROW_LINE_IDS[rowId]) return ROW_LINE_IDS[rowId];
	if (rowId === 'total_capex') return allLineIds.filter((id) => id.startsWith('capex:'));
	if (rowId === 'net_cash_flow') {
		return [
			...INCOME_LINE_IDS,
			...EXPENSE_LINE_IDS,
			...MORTGAGE_LINE_IDS,
			...allLineIds.filter((id) => id.startsWith('capex:')),
		];
	}
	if (
		INCOME_LINE_IDS.includes(rowId)
		|| EXPENSE_LINE_IDS.includes(rowId)
		|| MORTGAGE_LINE_IDS.includes(rowId)
		|| rowId.startsWith('capex:')
		|| rowId === 'uncategorized'
		|| rowId === 'transfer'
	) {
		return [rowId];
	}
	return [rowId];
}

function signedDrilldownAmount(item, rowId) {
	const incomeRows = new Set([...INCOME_LINE_IDS, 'uncategorized']);
	const isAggregate = ['noi', 'net_cash_flow'].includes(rowId);

	if (isAggregate) {
		if (INCOME_LINE_IDS.includes(item.lineId) || item.lineId === 'uncategorized') {
			return item.reportAmount;
		}
		return -Math.abs(item.reportAmount);
	}

	if (incomeRows.has(item.lineId)) return item.reportAmount;
	return -Math.abs(item.reportAmount);
}

export function filterDrilldownItems(items, { rowId, periodKey }) {
	const allLineIds = [...new Set((items || []).map((i) => i.lineId))];
	const lineIds = getLineIdsForRow(rowId, allLineIds);

	return (items || [])
		.filter((item) => {
			if (!lineIds.includes(item.lineId)) return false;
			if (periodKey && periodKey !== 'total') {
				return item.periodKey === periodKey;
			}
			return true;
		})
		.map((item) => ({
			...item,
			displayAmount: signedDrilldownAmount(item, rowId),
		}))
		.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export function filterScheduleEDrilldown(items, scheduleLine) {
	return (items || [])
		.filter((item) => item.schedule_line === scheduleLine)
		.map((item) => ({
			...item,
			displayAmount: item.amount,
		}))
		.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export function filterOwnerStatementReservations(reservations, { field, reservationId }) {
	if (reservationId) {
		return (reservations || []).filter((r) => r.id === reservationId);
	}
	return reservations || [];
}

export function ownerStatementFieldAmount(reservation, field) {
	switch (field) {
		case 'revenue': return reservation.revenue;
		case 'total_paid_to_manager': return reservation.total_paid_to_manager;
		case 'remaining_balance_due': return reservation.remaining_balance_due;
		default: return 0;
	}
}
