import { format, parseISO, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { formatDateOrDash } from './dates';
import { getPropertyDisplayName } from './codes';
import { platformLabel as formatPlatformLabel } from './hospitable';
import { getReservationSplits } from './reservationSplits';
import { scoreReservationMatch } from './reservationMatching';

const CASH_ITEM_AMOUNT_TOLERANCE = 5;

export const OWNER_STATEMENT_MANAGER = 'Hello Neighbor Real Estate Group';
export const OWNER_STATEMENT_MANAGER_ADDRESS = {
	line1: '2407 SE Delaware Avenue, #1136',
	line2: 'Ankeny, Iowa, 50021',
};
export const MANAGEMENT_COMPANY_NAME = 'HN Global, LLC';
export const OWNER_STATEMENT_DUE_TO_HN_LABEL = 'Due to HN Global';
export const OWNER_STATEMENT_HN_TOTAL_LABEL = `Due to ${MANAGEMENT_COMPANY_NAME}`;
export const OWNER_STATEMENT_MANAGEMENT_FEE_NOTE = 'Management Fee is calculated on the Gross Booking Amount less Cleaning Fee.';
export const DEFAULT_MANAGEMENT_FEE_PERCENT = 20;

function toDate(value) {
	if (!value) return null;
	const s = String(value).trim().slice(0, 10);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
	const d = parseISO(`${s}T12:00:00`);
	return Number.isNaN(d.getTime()) ? null : d;
}

function cents(value) {
	if (value == null) return 0;
	if (typeof value === 'number') return value / 100;
	if (typeof value === 'object' && value.amount != null) return value.amount / 100;
	return 0;
}

export function formatPropertyAddressTwoLines(property) {
	const addr = property?.address;
	if (!addr) return { line1: '', line2: '', full: '' };

	const line1 = [addr.street, addr.street2].filter(Boolean).join(', ')
		|| [addr.line1, addr.line2].filter(Boolean).join(', ');
	const line2 = [addr.city, addr.state, addr.postcode || addr.zip].filter(Boolean).join(', ');
	const full = [line1, line2, addr.country].filter(Boolean).join(', ');
	return { line1, line2, full };
}

/** Split a single-line address into street line and city/state/zip line. */
export function formatAddressTwoLines(address) {
	if (!address) return { line1: '', line2: '' };
	const trimmed = String(address).trim();
	if (!trimmed) return { line1: '', line2: '' };
	if (trimmed.includes('\n')) {
		const lines = trimmed.split('\n').map((line) => line.trim()).filter(Boolean);
		return {
			line1: lines[0] || '',
			line2: lines.slice(1).join(', '),
		};
	}
	const parts = trimmed.split(',').map((part) => part.trim()).filter(Boolean);
	if (parts.length <= 1) return { line1: trimmed, line2: '' };
	if (parts.length === 2) return { line1: parts[0], line2: parts[1] };

	const last = parts[parts.length - 1];
	const hasZip = /^\d{5}(-\d{4})?$/.test(last);
	if (hasZip && parts.length >= 3) {
		const zip = last;
		const state = parts.length >= 4 ? parts[parts.length - 2] : '';
		const city = parts.length >= 4 ? parts[parts.length - 3] : parts[parts.length - 2];
		const streetParts = parts.slice(0, parts.length >= 4 ? -3 : -2);
		return {
			line1: streetParts.join(', '),
			line2: state ? [city, state, zip].join(', ') : [city, zip].join(', '),
		};
	}

	return {
		line1: parts[0],
		line2: parts.slice(1).join(', '),
	};
}

export function ownerStatementPdfFilename(statement) {
	const raw = (statement?.statement_period || 'owner-statement').trim();
	const safe = raw.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
	return `${safe || 'owner-statement'}.pdf`;
}

export function formatOwnerRecipient(property, storedOwner) {
	if (storedOwner && (storedOwner.name || storedOwner.address || storedOwner.email || storedOwner.phone)) {
		const addressLines = formatAddressTwoLines(storedOwner.address || '');
		return {
			name: storedOwner.name || '',
			address: storedOwner.address || '',
			address_line1: addressLines.line1,
			address_line2: addressLines.line2,
			email: storedOwner.email || '',
			phone: storedOwner.phone || '',
		};
	}

	const user = property?.user || property?.owner;
	if (!user) {
		return {
			name: '', address: '', address_line1: '', address_line2: '', email: '', phone: '',
		};
	}

	const name = [user.first_name, user.last_name].filter(Boolean).join(' ')
		|| user.name
		|| user.full_name
		|| '';
	const addr = user.address || user.mailing_address || {};
	const address_line1 = [addr.street, addr.street2].filter(Boolean).join(', ')
		|| [addr.line1, addr.line2].filter(Boolean).join(', ');
	const address_line2 = [addr.city, addr.state, addr.postcode || addr.zip].filter(Boolean).join(', ');
	const address = [address_line1, address_line2, addr.country].filter(Boolean).join(', ');

	return {
		name,
		address,
		address_line1,
		address_line2,
		email: user.email || '',
		phone: user.phone || user.phone_numbers?.[0] || '',
	};
}

export function formatStatementPeriodLabel(dateFrom, dateTo) {
	if (!dateFrom) return 'Statement';
	const from = toDate(dateFrom);
	const to = toDate(dateTo) || from;
	if (!from) return 'Statement';

	const monthStart = startOfMonth(from);
	const monthEnd = endOfMonth(from);
	if (
		to
		&& isSameDay(from, monthStart)
		&& isSameDay(to, monthEnd)
		&& from.getMonth() === to.getMonth()
		&& from.getFullYear() === to.getFullYear()
	) {
		return `${format(from, 'MMMM yyyy')}`;
	}

	return `${formatDateOrDash(dateFrom)} through ${formatDateOrDash(dateTo)}`;
}

export function formatStatementReservationDates(checkIn, checkOut) {
	const start = toDate(checkIn);
	const end = toDate(checkOut);
	if (!start) return '—';
	if (!end || format(start, 'yyyy-MM') === format(end, 'yyyy-MM')) {
		return `${format(start, 'MMM dd')}${end ? `-${format(end, 'dd')}` : ''}`;
	}
	return `${formatDateOrDash(checkIn)} – ${formatDateOrDash(checkOut)}`;
}

export function formatStatementNights(nights) {
	const n = Number(nights) || 0;
	if (!n) return '—';
	return `${n} of ${n}`;
}

export function statementMonthFromCheckIn(checkIn) {
	if (!checkIn) return null;
	const month = String(checkIn).trim().slice(0, 7);
	return /^\d{4}-\d{2}$/.test(month) ? month : null;
}

export function statementMonthFromDate(date) {
	return statementMonthFromCheckIn(date);
}

export function formatStatementMonthLabel(statementMonth) {
	if (!statementMonth || !/^\d{4}-\d{2}$/.test(statementMonth)) return '';
	const d = parseISO(`${statementMonth}-01T12:00:00`);
	return Number.isNaN(d.getTime()) ? statementMonth : format(d, 'MMMM yyyy');
}

/** Map manual expense ids to the most recent approved owner statement that included them. */
export function mapApprovedManualExpenseInclusions(approvals = []) {
	const byExpenseId = new Map();
	for (const approval of approvals) {
		const transactions = approval.statement_data?.transactions || [];
		for (const tx of transactions) {
			if (tx.source !== 'manual' || !tx.id) continue;
			const existing = byExpenseId.get(tx.id);
			const approvedAt = approval.approved_at || '';
			if (!existing || String(approvedAt) > String(existing.approved_at || '')) {
				byExpenseId.set(tx.id, {
					approval_id: approval.id,
					property_id: approval.property_id,
					statement_period: approval.statement_period || null,
					approved_at: approval.approved_at || null,
				});
			}
		}
	}
	return byExpenseId;
}

export function attachOwnerStatementInclusion(expense, inclusionByExpenseId) {
	const inclusion = inclusionByExpenseId?.get(expense.id);
	if (!inclusion) {
		return { ...expense, owner_statement_inclusion: null };
	}
	return {
		...expense,
		owner_statement_inclusion: {
			included: true,
			statement_period: inclusion.statement_period,
			approved_at: inclusion.approved_at,
			approval_id: inclusion.approval_id,
		},
	};
}

export function statementMonthInReportPeriod(statementMonth, dateFrom, dateTo) {
	if (!statementMonth) return false;
	const fromMonth = dateFrom ? String(dateFrom).slice(0, 7) : null;
	const toMonth = dateTo ? String(dateTo).slice(0, 7) : fromMonth;
	if (fromMonth && statementMonth < fromMonth) return false;
	if (toMonth && statementMonth > toMonth) return false;
	return true;
}

export function getStatementMonthOptions(year = new Date().getFullYear()) {
	return Array.from({ length: 12 }, (_, index) => {
		const month = String(index + 1).padStart(2, '0');
		const value = `${year}-${month}`;
		return {
			value,
			label: formatStatementMonthLabel(value),
		};
	});
}

function roundMoney(n) {
	return Math.round((Number(n) || 0) * 100) / 100;
}

export function resolveManagementFeePercent(value) {
	if (value == null || value === '') return DEFAULT_MANAGEMENT_FEE_PERCENT;
	const n = Number(value);
	if (!Number.isFinite(n) || n < 0 || n > 100) return DEFAULT_MANAGEMENT_FEE_PERCENT;
	return roundMoney(n);
}

export function getReservationResolutions(row) {
	return roundMoney((row?.fees_by_label || {}).Resolutions || 0);
}

export function calculateBookingRevenue(row) {
	const fees = row.fees_by_label || {};
	const accommodation = fees.Accommodation || row.accommodation || 0;
	const promotions = Math.abs(fees.Promotions || 0);
	const petFee = fees['Pet Fee'] || row.pet_fee || 0;
	const extraGuestFee = fees['Extra Guest Fee'] || row.extra_guest_fee || 0;
	return roundMoney(accommodation + extraGuestFee + petFee - promotions);
}

export function calculateGrossBookingAmount(row) {
	return calculateBookingRevenue(row);
}

/** Base for management fee % — gross booking amount less cleaning fee. */
export function calculateManagementFeeBase(row) {
	const gross = calculateGrossBookingAmount(row);
	const cleaningFee = row.cleaning_fee || row.fees_by_label?.['Cleaning Fee'] || 0;
	return roundMoney(Math.max(0, gross - cleaningFee));
}

export function calculateBookingNetRevenue(row) {
	const netRevenue = row.net_revenue ?? calculateNetReservationIncome(row);
	const cleaningFee = row.cleaning_fee || 0;
	const managementFee = row.reservation_commissions || 0;
	return roundMoney(netRevenue - cleaningFee - managementFee);
}

function calculateEarningsTotal(row) {
	return calculateManagementFeeBase(row);
}

export function calculateManagementFee(row, managementFeePercent) {
	const percent = resolveManagementFeePercent(
		managementFeePercent ?? row.management_fee_percent,
	);
	const base = calculateManagementFeeBase(row);
	return roundMoney(base * (percent / 100));
}

export function calculateOwnerPayout(row) {
	const earningsTotal = calculateEarningsTotal(row);
	const hostServiceFee = row.host_service_fee_amount
		?? Math.abs(row.host_service_fee || 0);
	const managementFee = row.reservation_commissions || 0;
	const cleaningFee = row.cleaning_fee || 0;
	const revenue = row.revenue || row.net_reservation_income || 0;
	const resolutions = getReservationResolutions(row);

	if (revenue > 0) {
		// Host revenue is the platform payout (after channel fee, includes cleaning pass-through).
		// Resolution payouts/adjustments are optional add-ons, not included by default.
		return roundMoney(revenue - managementFee - cleaningFee - resolutions);
	}

	return roundMoney(earningsTotal - hostServiceFee - managementFee - cleaningFee);
}

export function calculateNetReservationIncome(row) {
	const fees = row.fees_by_label || {};
	const bookingRevenue = calculateBookingRevenue(row);
	const cleaningFee = row.cleaning_fee || fees['Cleaning Fee'] || 0;
	const hostServiceFee = row.host_service_fee_amount
		?? Math.abs(fees['Host Service Fee'] || row.host_service_fee || 0);
	if (bookingRevenue > 0 || cleaningFee > 0) {
		return roundMoney(bookingRevenue - hostServiceFee + cleaningFee);
	}
	const hostPayout = row.revenue || row.net_reservation_income || 0;
	return roundMoney(hostPayout);
}

export function enrichOwnerStatementReservation(row, { managementFeePercent } = {}) {
	const fees = row.fees_by_label || {};
	const accommodation = fees.Accommodation || row.accommodation || 0;
	const promotions = Math.abs(fees.Promotions || 0);
	const commissionableBase = Math.max(0, accommodation - promotions);
	const grossBookingAmount = calculateGrossBookingAmount(row);
	const cleaningFee = fees['Cleaning Fee'] || row.cleaning_fee || 0;
	const managementFeeBase = calculateManagementFeeBase({ ...row, cleaning_fee: cleaningFee });
	const percent = resolveManagementFeePercent(
		managementFeePercent ?? row.management_fee_percent,
	);
	const reservationCommissions = calculateManagementFee(
		{ ...row, cleaning_fee: cleaningFee },
		managementFeePercent ?? row.management_fee_percent,
	);
	const totalOwedToManager = roundMoney(reservationCommissions + cleaningFee);
	const hostServiceFee = -(Math.abs(fees['Host Service Fee'] || row.host_service_fee || 0));
	const petFee = fees['Pet Fee'] || 0;
	const accommodationRevenue = fees.Accommodation || row.accommodation || 0;
	const resolutionPayout = getReservationResolutions(row);
	const lodgingTaxes = fees['Lodging Taxes'] || row.lodging_taxes || 0;
	const netReservationIncome = row.revenue || 0;
	const netOwnerIncome = calculateOwnerPayout({
		...row,
		revenue: netReservationIncome,
		reservation_commissions: reservationCommissions,
		cleaning_fee: cleaningFee,
		host_service_fee_amount: roundMoney(Math.abs(fees['Host Service Fee'] || row.host_service_fee || 0)),
	});
	const netRevenue = calculateNetReservationIncome({
		...row,
		cleaning_fee: cleaningFee,
		host_service_fee_amount: roundMoney(Math.abs(fees['Host Service Fee'] || row.host_service_fee || 0)),
	});
	const bookingNetRevenue = calculateBookingNetRevenue({
		...row,
		net_revenue: netRevenue,
		cleaning_fee: cleaningFee,
		reservation_commissions: reservationCommissions,
	});

	return {
		...row,
		net_reservation_income: netReservationIncome,
		net_revenue: netRevenue,
		gross_booking_amount: roundMoney(grossBookingAmount),
		booking_net_revenue: bookingNetRevenue,
		commissionable_base: roundMoney(commissionableBase),
		earnings_total: managementFeeBase,
		management_fee_base: managementFeeBase,
		management_fee_percent: percent,
		reservation_commissions: reservationCommissions,
		cleaning_fee: roundMoney(cleaningFee),
		total_owed_to_manager: totalOwedToManager,
		host_service_fee: roundMoney(hostServiceFee),
		host_service_fee_amount: roundMoney(Math.abs(fees['Host Service Fee'] || row.host_service_fee || 0)),
		pet_fee: roundMoney(petFee),
		accommodation_revenue: roundMoney(accommodationRevenue),
		resolution_payout: roundMoney(resolutionPayout),
		guest_service_fee: roundMoney(hostServiceFee),
		lodging_taxes: roundMoney(lodgingTaxes),
		extra_guest_fee: roundMoney(fees['Extra Guest Fee'] || 0),
		net_owner_income: netOwnerIncome,
		date_range: formatStatementReservationDates(row.check_in, row.check_out),
		nights_label: formatStatementNights(row.nights),
	};
}

export function buildOwnerStatementWaterfall(row) {
	const fees = row.fees_by_label || {};
	const platformName = row.platform_label || formatPlatformLabel(row.platform) || 'Reservation';
	const cleaningFee = row.cleaning_fee || fees['Cleaning Fee'] || 0;
	const hostServiceFee = row.host_service_fee_amount
		|| Math.abs(fees['Host Service Fee'] || row.host_service_fee || 0);
	const managementFee = row.reservation_commissions || 0;
	const hostPayout = row.net_reservation_income || 0;
	const netOwnerIncome = calculateOwnerPayout(row);
	const netReservationIncomeAmount = calculateNetReservationIncome(row);
	const totalOwedToManager = row.total_owed_to_manager || roundMoney(managementFee + cleaningFee);
	const ownerName = row.owner_name?.trim() || 'Owner';
	const accommodation = fees.Accommodation || row.accommodation || 0;
	const petFee = fees['Pet Fee'] || row.pet_fee || 0;
	const extraGuestFee = fees['Extra Guest Fee'] || row.extra_guest_fee || 0;
	const resolutions = fees.Resolutions || 0;
	const promotions = Math.abs(fees.Promotions || 0);

	const reservationLines = [];
	if (accommodation > 0) {
		reservationLines.push({ label: 'Accommodation Revenue', amount: accommodation });
	} else if (hostPayout > 0) {
		reservationLines.push({ label: 'Accommodation Revenue', amount: hostPayout });
	}
	if (petFee > 0) {
		reservationLines.push({ label: 'Pet Fee Revenue', amount: petFee });
	}
	if (extraGuestFee > 0) {
		reservationLines.push({ label: 'Extra Guest Fee', amount: extraGuestFee });
	}
	if (resolutions > 0) {
		reservationLines.push({ label: 'Resolution Payout', amount: resolutions });
	}
	if (promotions > 0) {
		reservationLines.push({ label: 'Promotions', amount: -promotions, signed: true });
	}
	if (hostServiceFee > 0) {
		reservationLines.push({
			label: `Guest Service Fee (${platformName})`,
			amount: -hostServiceFee,
			signed: true,
		});
	}
	if (cleaningFee > 0) {
		reservationLines.push({
			label: 'Guest Cleaning Fee',
			amount: cleaningFee,
		});
	}

	const managementLines = [];
	if (managementFee > 0) {
		managementLines.push({ label: 'Management Fee', amount: -managementFee, signed: true });
	}
	if (cleaningFee > 0) {
		managementLines.push({
			label: 'Cleaning Fee',
			amount: -cleaningFee,
			signed: true,
		});
	}

	const sections = [
		(reservationLines.length > 0 || netReservationIncomeAmount != null) && {
			key: 'reservation-income',
			title: `${platformName} Reservation Income Detail`,
			lines: reservationLines,
			footerAmount: netReservationIncomeAmount,
		},
		{
			key: 'reservation-expenses',
			title: 'Reservation Expense Detail',
			lines: managementLines,
			footerAmount: totalOwedToManager,
		},
		{
			key: 'due-to-manager',
			title: `Due to ${MANAGEMENT_COMPANY_NAME}`,
			lines: [],
			totalAmount: totalOwedToManager,
		},
		{
			key: 'owner-payout',
			title: `Due To ${ownerName}`,
			lines: [],
			totalAmount: netOwnerIncome,
		},
	].filter(Boolean);

	return {
		netReservationIncome: netReservationIncomeAmount,
		sections,
	};
}

export function extractReservationAdjustments(reservation, propMap) {
	const hostFin = reservation.financials?.host;
	const adjustments = hostFin?.adjustments || [];
	if (!adjustments.length) return [];

	const guestName = reservation.guest
		? [reservation.guest.first_name, reservation.guest.last_name].filter(Boolean).join(' ')
		: null;
	const property = propMap[reservation.property_id];
	const propertyName = property?.name || property?.public_name || '';

	return adjustments.map((adj, index) => ({
		id: `${reservation.id}-adj-${index}`,
		date: reservation.check_in || reservation.arrival_date,
		property_name: propertyName,
		code: reservation.code,
		guest_name: guestName,
		reason: adj.label || adj.description || adj.type || 'Adjustment',
		amount: roundMoney(cents(adj)),
	}));
}

/** Bank/manual cash already represented on reservation rows (matched or amount-aligned). */
export function isCashItemIncludedInReservations(cashItem, reservations = []) {
	if (!cashItem) return false;
	if (cashItem.source === 'manual') return false;

	if (cashItem.matched_reservation_id) return true;
	if (getReservationSplits(cashItem).length > 0) return true;

	const txAmount = Number(cashItem.amount) || 0;
	if (txAmount <= 0) return false;

	for (const reservation of reservations) {
		if (reservation.property_id && cashItem.property_id !== reservation.property_id) continue;

		const fees = reservation.fees_by_label || {};
		const resolutions = Math.abs(fees.Resolutions || 0);
		if (resolutions > 0.01 && Math.abs(txAmount - resolutions) <= CASH_ITEM_AMOUNT_TOLERANCE) {
			return true;
		}

		const cleaning = Math.abs(fees['Cleaning Fee'] || reservation.cleaning_fee || 0);
		if (cleaning > 0.01 && Math.abs(txAmount - cleaning) <= CASH_ITEM_AMOUNT_TOLERANCE) {
			return true;
		}

		if (scoreReservationMatch(cashItem, reservation)) {
			return true;
		}
	}

	return false;
}

export function ownerStatementTransactions(cashItems, propertyId, propertyName = '', { reservations = [] } = {}) {
	return (cashItems || [])
		.filter((item) => {
			if (item.property_id !== propertyId) return false;
			return !isCashItemIncludedInReservations(item, reservations);
		})
		.map((item) => ({
			id: item.id,
			source: item.source || 'bank',
			date: item.date,
			description: item.description,
			notes: item.notes || '',
			category: item.category,
			amount: roundMoney(item.amount),
			property_id: propertyId,
			property_name: propertyName || item.property_name || '',
		}))
		.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export function applyOwnerStatementItemSelection(statement, selection) {
	const transactions = (statement.transactions || []).filter(
		(row) => !selection?.transactionIds || selection.transactionIds.has(row.id),
	);
	const adjustments = (statement.adjustments || []).filter(
		(row) => !selection?.adjustmentIds || selection.adjustmentIds.has(row.id),
	);
	const totals = summarizeOwnerStatement(
		statement.reservations,
		transactions,
		adjustments,
	);
	return {
		...statement,
		transactions,
		adjustments,
		totals,
	};
}

export function summarizeOwnerStatement(reservations, transactions = [], adjustments = []) {
	const reservationTotals = (reservations || []).reduce((acc, row) => {
		acc.net_reservation_income += row.net_reservation_income || 0;
		acc.reservation_commissions += row.reservation_commissions || 0;
		acc.cleaning_fee += row.cleaning_fee || 0;
		acc.total_owed_to_manager += row.total_owed_to_manager || 0;
		acc.net_owner_income += row.net_owner_income || 0;
		acc.booking_total += row.management_fee_base ?? row.earnings_total ?? 0;
		acc.gross_booking_amount += row.gross_booking_amount ?? calculateGrossBookingAmount(row);
		acc.booking_net_revenue += row.booking_net_revenue ?? calculateBookingNetRevenue(row);
		acc.net_revenue += row.net_revenue ?? calculateNetReservationIncome(row);
		acc.accommodation_revenue += row.accommodation_revenue || 0;
		acc.pet_fee_revenue += row.pet_fee || 0;
		acc.resolution_payout += row.resolution_payout || 0;
		acc.guest_service_fee += row.guest_service_fee || 0;
		acc.nights += Number(row.nights) || 0;
		return acc;
	}, {
		net_reservation_income: 0,
		reservation_commissions: 0,
		cleaning_fee: 0,
		total_owed_to_manager: 0,
		net_owner_income: 0,
		booking_total: 0,
		gross_booking_amount: 0,
		booking_net_revenue: 0,
		net_revenue: 0,
		accommodation_revenue: 0,
		pet_fee_revenue: 0,
		resolution_payout: 0,
		guest_service_fee: 0,
		nights: 0,
	});

	const transactionTotal = roundMoney(
		(transactions || []).reduce((sum, row) => sum + (row.amount || 0), 0),
	);
	const adjustmentTotal = roundMoney(
		(adjustments || []).reduce((sum, row) => sum + (row.amount || 0), 0),
	);

	const totalDueToHnGlobal = roundMoney(
		reservationTotals.reservation_commissions
		+ reservationTotals.cleaning_fee
		+ transactionTotal
		+ adjustmentTotal,
	);

	return {
		total_nights: reservationTotals.nights,
		total_accommodation_revenue: roundMoney(reservationTotals.accommodation_revenue),
		total_pet_fee_revenue: roundMoney(reservationTotals.pet_fee_revenue),
		total_resolution_payout: roundMoney(reservationTotals.resolution_payout),
		total_guest_service_fee: roundMoney(reservationTotals.guest_service_fee),
		total_booking_total: roundMoney(reservationTotals.booking_total),
		total_gross_booking_amount: roundMoney(reservationTotals.gross_booking_amount),
		total_booking_net_revenue: roundMoney(reservationTotals.booking_net_revenue),
		total_net_revenue: roundMoney(reservationTotals.net_revenue),
		total_reservation_income: roundMoney(reservationTotals.net_reservation_income),
		reservation_commissions_to_manager: roundMoney(reservationTotals.reservation_commissions),
		total_cleaning_fee: roundMoney(reservationTotals.cleaning_fee),
		total_owed_to_manager: roundMoney(reservationTotals.total_owed_to_manager),
		total_due_to_hn_global: totalDueToHnGlobal,
		total_net_reservation_income_to_owner: roundMoney(reservationTotals.net_owner_income),
		transaction_total: transactionTotal,
		adjustment_total: adjustmentTotal,
		total_due_to_owner: roundMoney(reservationTotals.net_revenue - totalDueToHnGlobal),
	};
}

export function statementAdjustmentsTotal(totals) {
	return roundMoney((Number(totals?.transaction_total) || 0) + (Number(totals?.adjustment_total) || 0));
}

export function buildPropertyOwnerStatement({
	property,
	ownerRecord,
	reservations,
	transactions = [],
	adjustments = [],
	dateFrom,
	dateTo,
}) {
	const enriched = (reservations || []).map((row) => (
		row.management_fee_base != null
			? row
			: enrichOwnerStatementReservation(row, {
				managementFeePercent: ownerRecord?.management_fee_percent,
			})
	));
	const totals = summarizeOwnerStatement(enriched, transactions, adjustments);
	const propertyAddress = formatPropertyAddressTwoLines(property);

	return {
		property_id: property.id,
		property_name: property.name || property.public_name || getPropertyDisplayName(property),
		property_label: getPropertyDisplayName(property) || property.name || property.public_name,
		property_address: propertyAddress.full,
		property_address_line1: propertyAddress.line1,
		property_address_line2: propertyAddress.line2,
		recipient: formatOwnerRecipient(property, ownerRecord),
		statement_period: formatStatementPeriodLabel(dateFrom, dateTo),
		notes: '',
		reservations: enriched,
		transactions,
		adjustments,
		totals,
	};
}
