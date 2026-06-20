/** Split one bank transaction across multiple reservation attributions. */

import { getReservationPayout, isPayoutMatchAllowed, payoutOverflowTolerance } from './reservationMatching';

export const SPLIT_TYPES = {
	INCOME: 'income',
	ADJUSTMENT: 'adjustment',
};

function normalizeSplitEntry(entry) {
	if (!entry?.reservation_id) return null;
	const amount = Number(entry.amount);
	if (!Number.isFinite(amount) || amount === 0) return null;
	const type = entry.type === SPLIT_TYPES.ADJUSTMENT ? SPLIT_TYPES.ADJUSTMENT : SPLIT_TYPES.INCOME;
	return {
		reservation_id: String(entry.reservation_id),
		amount,
		type,
	};
}

/** Effective splits for a transaction (JSON column or legacy single match). */
export function getReservationSplits(tx) {
	if (Array.isArray(tx?.reservation_splits) && tx.reservation_splits.length) {
		return tx.reservation_splits.map(normalizeSplitEntry).filter(Boolean);
	}
	if (tx?.matched_reservation_id) {
		return [{
			reservation_id: tx.matched_reservation_id,
			amount: Number(tx.amount) || 0,
			type: SPLIT_TYPES.INCOME,
		}];
	}
	return [];
}

export function splitsSum(splits) {
	return (splits || []).reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
}

export function validateReservationSplits(splits, txAmount) {
	const normalized = (splits || []).map(normalizeSplitEntry).filter(Boolean);
	if (!normalized.length) return { error: 'Add at least one reservation split.' };

	const bankAmount = Number(txAmount) || 0;
	const sum = splitsSum(normalized);
	if (Math.abs(sum - bankAmount) > 0.01) {
		return {
			error: `Split amounts (${sum.toFixed(2)}) must equal the bank transaction (${bankAmount.toFixed(2)}).`,
			splits: normalized,
		};
	}

	return { splits: normalized, error: null };
}

export function primaryMatchedReservationId(splits) {
	const income = (splits || []).find((s) => s.type === SPLIT_TYPES.INCOME);
	return income?.reservation_id || splits?.[0]?.reservation_id || null;
}

/** Sum positive income splits per reservation across loaded transactions. */
export function buildMatchedIncomeById(transactions) {
	const totals = new Map();
	for (const tx of transactions || []) {
		for (const split of getReservationSplits(tx)) {
			if (split.type !== SPLIT_TYPES.INCOME) continue;
			const amount = Number(split.amount) || 0;
			if (amount <= 0) continue;
			totals.set(
				split.reservation_id,
				(totals.get(split.reservation_id) || 0) + amount,
			);
		}
	}
	return totals;
}

export function sumSplitsForReservation(splits, reservationId, { incomeOnly = true } = {}) {
	return (splits || []).reduce((sum, split) => {
		if (split.reservation_id !== reservationId) return sum;
		if (incomeOnly && split.type !== SPLIT_TYPES.INCOME) return sum;
		return sum + (Number(split.amount) || 0);
	}, 0);
}

export function validateSplitPayoutCaps(splits, reservations, { excludeTransactionId, existingRows = [] } = {}) {
	const reservationById = Object.fromEntries((reservations || []).map((r) => [r.id, r]));
	const incomeByReservation = new Map();

	for (const row of existingRows) {
		if (excludeTransactionId && row.id === excludeTransactionId) continue;
		for (const split of getReservationSplits(row)) {
			if (split.type !== SPLIT_TYPES.INCOME) continue;
			const amt = Number(split.amount) || 0;
			if (amt <= 0) continue;
			incomeByReservation.set(
				split.reservation_id,
				(incomeByReservation.get(split.reservation_id) || 0) + amt,
			);
		}
	}

	for (const split of splits) {
		if (split.type !== SPLIT_TYPES.INCOME) continue;
		const amt = Number(split.amount) || 0;
		if (amt <= 0) continue;
		const reservation = reservationById[split.reservation_id];
		const cap = getReservationPayout(reservation);
		if (!cap) continue;
		const already = incomeByReservation.get(split.reservation_id) || 0;
		const nextTotal = already + amt;
		if (!isPayoutMatchAllowed(nextTotal, cap)) {
			const code = reservation?.code || split.reservation_id;
			return `Income split for ${code} exceeds reservation payout (${nextTotal.toFixed(2)} > ${cap.toFixed(2)}, tolerance ${payoutOverflowTolerance(cap).toFixed(2)}).`;
		}
		incomeByReservation.set(split.reservation_id, nextTotal);
	}

	return null;
}

export function splitSummaryLabel(splits, reservationById) {
	const list = splits || [];
	if (!list.length) return '';
	if (list.length === 1) {
		const r = reservationById[list[0].reservation_id];
		return r?.code || list[0].reservation_id;
	}
	return list.map((s) => {
		const r = reservationById[s.reservation_id];
		const code = r?.code || s.reservation_id?.slice(0, 8);
		return code;
	}).join(' + ');
}

/**
 * When a bank deposit is less than a reservation's payout (bundled Airbnb payout),
 * suggest income + adjustment rows so the user only picks the adjustment reservation.
 */
export function suggestBundledPayoutSplits(tx, reservation) {
	if (!reservation || !tx) return null;
	const txAmount = Number(tx.amount) || 0;
	const payout = getReservationPayout(reservation);
	if (txAmount <= 0 || payout <= 0 || txAmount >= payout - 0.01) return null;

	const adjustment = txAmount - payout;
	if (Math.abs(adjustment) > payoutOverflowTolerance(payout)) return null;

	return [
		{ reservation_id: reservation.id, amount: payout, type: SPLIT_TYPES.INCOME },
		{ reservation_id: '', amount: adjustment, type: SPLIT_TYPES.ADJUSTMENT },
	];
}

export function syncMatchFieldsFromSplits(tx, splits) {
	const normalized = (splits || []).map(normalizeSplitEntry).filter(Boolean);
	const primaryId = primaryMatchedReservationId(normalized);
	return {
		reservation_splits: normalized,
		matched_reservation_id: primaryId,
		matched_payout_amount: normalized.length === 1 && primaryId
			? (tx.matched_payout_amount ?? null)
			: null,
	};
}
