/** Match bank deposits to Hospitable reservation host payouts. */

import { DEFAULT_RENTAL_INCOME_CATEGORY } from './bookkeepingCategories';

const DEFAULT_AMOUNT_TOLERANCE = 5;
/** Allow bank deposits to exceed Hospitable revenue slightly (split payouts, pass-through). */
const MIN_PAYOUT_OVERFLOW_TOLERANCE = 25;
const PAYOUT_OVERFLOW_TOLERANCE_RATE = 0.03;
// STR platforms (Airbnb/VRBO/etc.) typically release the host payout shortly after
// check-in or 1–7+ days after check-out. Allow deposits up to this many days past
// check-out so the most common payout timing still matches.
const DEFAULT_POST_CHECKOUT_GRACE_DAYS = 30;

function parseDate(value) {
	if (!value) return null;
	const d = new Date(`${String(value).slice(0, 10)}T12:00:00`);
	return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(a, b) {
	return Math.round((a.getTime() - b.getTime()) / 86400000);
}

function addDays(date, days) {
	return new Date(date.getTime() + days * 86400000);
}

export function payoutOverflowTolerance(payout) {
	const base = Number(payout) || 0;
	return Math.max(MIN_PAYOUT_OVERFLOW_TOLERANCE, base * PAYOUT_OVERFLOW_TOLERANCE_RATE);
}

/** Cap for matched bank deposits — at least Hospitable revenue, expands to actual bank total. */
export function effectivePayoutCap(reservation, tx, matchedIncomeById) {
	const hospitablePayout = getReservationPayout(reservation);
	const alreadyMatched = alreadyMatchedExcludingTx(reservation?.id, tx, matchedIncomeById);
	const txAmount = Number(tx?.amount) || 0;
	return Math.max(hospitablePayout, alreadyMatched + txAmount);
}

export function isPayoutMatchAllowed(nextTotal, payoutCap) {
	if (nextTotal <= payoutCap + 0.01) return true;
	return (nextTotal - payoutCap) <= payoutOverflowTolerance(payoutCap);
}

export function getReservationPayout(reservation) {
	return Number(reservation?.revenue ?? reservation?.owner_payout) || 0;
}

export function getMatchedIncomeForReservation(reservationId, matchedIncomeById) {
	if (!reservationId || !matchedIncomeById) return 0;
	if (matchedIncomeById instanceof Map) return matchedIncomeById.get(reservationId) || 0;
	return Number(matchedIncomeById[reservationId]) || 0;
}

/** Matched income on this reservation from other transactions (exclude current tx). */
export function alreadyMatchedExcludingTx(reservationId, tx, matchedIncomeById) {
	const total = getMatchedIncomeForReservation(reservationId, matchedIncomeById);
	if (!tx?.matched_reservation_id || tx.matched_reservation_id !== reservationId) {
		return total;
	}
	const txAmount = Number(tx.amount) || 0;
	return Math.max(0, total - txAmount);
}

/**
 * Bank deposit date must fall within the plausible payout window: from check-in through
 * check-out plus a post-checkout grace period (host payouts usually land after checkout).
 */
export function isBankDateWithinStay(
	txDate,
	reservation,
	{ postCheckoutGraceDays = DEFAULT_POST_CHECKOUT_GRACE_DAYS } = {},
) {
	const checkIn = parseDate(reservation.check_in);
	const checkOut = parseDate(reservation.check_out);
	if (!txDate || !checkIn || !checkOut) return false;
	return txDate >= checkIn && txDate <= addDays(checkOut, postCheckoutGraceDays);
}

/**
 * Compare a deposit amount to a reservation payout, accounting for prior matched deposits.
 * @returns {null|{ amountDiff: number, targetAmount: number, kind: string }}
 */
function scoreAmountAgainstPayout(txAmount, payout, alreadyMatched, amountTolerance) {
	// Additional deposits after prior matches on this reservation.
	if (alreadyMatched > 0.01) {
		const remaining = Math.max(0, payout - alreadyMatched);
		if (remaining > 0.01) {
			const diff = Math.abs(txAmount - remaining);
			if (diff <= amountTolerance) {
				return { amountDiff: diff, targetAmount: remaining, kind: 'remainder' };
			}
			return null;
		}
		// Hospitable revenue fully matched — allow a small trailing bank deposit.
		if (txAmount > 0 && txAmount <= payoutOverflowTolerance(payout)) {
			return { amountDiff: txAmount, targetAmount: txAmount, kind: 'overflow_tail' };
		}
		return null;
	}

	const remaining = Math.max(0, payout - alreadyMatched);
	if (remaining <= 0.01) return null;

	// Full payout in one deposit.
	const fullDiff = Math.abs(txAmount - payout);
	if (fullDiff <= amountTolerance) {
		return { amountDiff: fullDiff, targetAmount: payout, kind: 'full' };
	}

	// Single deposit slightly above Hospitable revenue (actual bank > reported revenue).
	if (txAmount > payout) {
		const over = txAmount - payout;
		if (over <= payoutOverflowTolerance(payout)) {
			return { amountDiff: over, targetAmount: txAmount, kind: 'overflow_single' };
		}
	}

	// First deposit of a split payout (e.g. $760.50 + $20.00 = $780.50).
	const splitRemainder = payout - txAmount;
	if (txAmount > 0 && txAmount < payout && splitRemainder > 0.01) {
		const maxSplitRemainder = Math.max(amountTolerance, payout * 0.15);
		if (splitRemainder <= maxSplitRemainder) {
			return {
				amountDiff: fullDiff,
				targetAmount: payout,
				kind: 'partial_first',
				splitRemainder,
			};
		}
	}

	return null;
}

/**
 * Score how well a reservation payout matches a bank deposit.
 * @returns {null|{ score: number, amountDiff: number, daysFromCheckIn: number, kind: string }}
 */
export function scoreReservationMatch(
	tx,
	reservation,
	{
		amountTolerance = DEFAULT_AMOUNT_TOLERANCE,
		postCheckoutGraceDays = DEFAULT_POST_CHECKOUT_GRACE_DAYS,
		alreadyMatched = 0,
	} = {},
) {
	const txAmount = Number(tx.amount);
	const payout = getReservationPayout(reservation);
	if (!txAmount || txAmount <= 0 || !payout) return null;

	const amountMatch = scoreAmountAgainstPayout(txAmount, payout, alreadyMatched, amountTolerance);
	if (!amountMatch) return null;

	const txDate = parseDate(tx.date);
	if (!txDate || !isBankDateWithinStay(txDate, reservation, { postCheckoutGraceDays })) return null;

	const checkIn = parseDate(reservation.check_in);
	const daysFromCheckIn = daysBetween(txDate, checkIn);
	let score = amountMatch.amountDiff + Math.abs(daysFromCheckIn) * 0.02;
	// Prefer continuing an in-progress split payout match.
	if (alreadyMatched > 0.01) score -= 50;
	if (amountMatch.kind === 'remainder' || amountMatch.kind === 'overflow_tail') score -= 25;

	return {
		score,
		amountDiff: amountMatch.amountDiff,
		daysFromCheckIn,
		kind: amountMatch.kind,
		targetAmount: amountMatch.targetAmount,
	};
}

/** Rank reservations that likely match this bank deposit (best first). */
export function rankReservationMatches(tx, reservations, options = {}) {
	const { reservationMatchedIncomeById, ...matchOptions } = options;
	const ranked = [];
	for (const reservation of reservations || []) {
		const alreadyMatched = alreadyMatchedExcludingTx(
			reservation.id,
			tx,
			reservationMatchedIncomeById,
		);
		const match = scoreReservationMatch(tx, reservation, {
			...matchOptions,
			alreadyMatched,
		});
		if (match) ranked.push({ reservation, ...match });
	}
	ranked.sort((a, b) => a.score - b.score);
	return ranked;
}

export function reservationMatchLabel(reservation, { amount, compact = false } = {}) {
	if (!reservation) return '';
	const payout = amount ?? reservation.revenue ?? reservation.owner_payout;
	const guest = reservation.guest_name || 'Guest';
	const code = reservation.code || '';
	if (compact) return `${code} · ${guest}`;
	return `${code} · ${guest} · $${Number(payout).toFixed(0)}`;
}

/** Summary for a matched deposit row (partial splits vs full payout). */
export function describeMatchedDeposit(tx, matched, matchedIncomeById) {
	const payout = Number(tx.matched_payout_amount) || getReservationPayout(matched);
	const txAmount = Number(tx.amount) || 0;
	const totalMatched = getMatchedIncomeForReservation(matched.id, matchedIncomeById);
	const remaining = Math.max(0, payout - totalMatched);

	if (payout <= 0) {
		return { type: 'empty', payout, txAmount, totalMatched, remaining };
	}
	if (Math.abs(txAmount - payout) <= 0.01 && remaining <= 0.01) {
		return { type: 'full', payout, txAmount, totalMatched, remaining };
	}
	if (totalMatched > txAmount + 0.01 || remaining > 0.01) {
		return { type: 'partial', payout, txAmount, totalMatched, remaining };
	}
	return {
		type: 'diff',
		payout,
		txAmount,
		totalMatched,
		remaining,
		diff: Math.abs(txAmount - payout),
	};
}

export function buildMatchPatch(tx, reservationId, reservations, { matchedIncomeById } = {}) {
	if (!reservationId) {
		return {
			matched_reservation_id: null,
			matched_payout_amount: null,
			reservation_splits: [],
		};
	}
	const reservation = reservations.find((r) => r.id === reservationId);
	if (!reservation) {
		return { matched_reservation_id: reservationId };
	}
	const cap = effectivePayoutCap(reservation, tx, matchedIncomeById);
	const txAmount = Number(tx.amount) || 0;
	return {
		matched_reservation_id: reservation.id,
		matched_payout_amount: cap || null,
		reservation_splits: [{
			reservation_id: reservation.id,
			amount: txAmount,
			type: 'income',
		}],
		property_id: reservation.property_id || null,
		category: tx.category?.trim() ? tx.category : DEFAULT_RENTAL_INCOME_CATEGORY,
	};
}
