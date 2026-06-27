import { withAuth } from '../../../../lib/auth';
import { isPayoutMatchAllowed } from '../../../../lib/reservationMatching';
import { parseHostFinancials } from '../../../../lib/hospitableFinancials';
import { getReservation } from '../../../../lib/hospitable';
import {
	primaryMatchedReservationId,
	validateReservationSplits,
	validateSplitPayoutCaps,
} from '../../../../lib/reservationSplits';
import {
	getBankTransactionById,
	getBankTransactions,
	sumMatchedIncomeForReservation,
	deleteBankTransaction,
	updateBankTransaction,
} from '../../../../lib/db';
import { assertCanEditOwnerStatementCashItem } from '../../../../lib/ownerStatementLock';

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		const { id } = req.query;
		if (!id) return res.status(400).json({ error: 'Transaction id required' });

		if (req.method === 'GET') {
			const tx = await getBankTransactionById(id);
			if (!tx) return res.status(404).json({ error: 'Transaction not found' });
			return res.json({ data: tx });
		}

		if (req.method === 'PATCH') {
			const {
				category, property_id, reviewed, hidden, notes,
				matched_reservation_id, matched_payout_amount,
				reservation_splits,
				admin_password,
			} = req.body || {};
			try {
				const tx = await getBankTransactionById(id);
				if (!tx) return res.status(404).json({ error: 'Transaction not found' });

				await assertCanEditOwnerStatementCashItem({
					property_id: tx.property_id,
					item_id: tx.id,
					item_source: 'bank',
					admin_password,
				});

				let payoutAmountToStore = matched_payout_amount;
				let splitsToStore = reservation_splits;
				let reservationIdToStore = matched_reservation_id;

				if (reservation_splits !== undefined) {
					const { splits, error: splitError } = validateReservationSplits(
						reservation_splits,
						tx.amount,
					);
					if (splitError) return res.status(400).json({ error: splitError });

					splitsToStore = splits;
					reservationIdToStore = primaryMatchedReservationId(splits);

					const capError = await validateSplitCapsForTx(id, splits);
					if (capError) return res.status(400).json({ error: capError });
				} else if (matched_reservation_id !== undefined) {
					const nextReservationId = matched_reservation_id || null;
					const txAmount = Number(tx.amount) || 0;
					const isIncome = txAmount > 0;

					if (isIncome && nextReservationId) {
						const cap = matched_payout_amount !== undefined
							? Number(matched_payout_amount)
							: Number(tx.matched_payout_amount);
						const payoutCap = Number.isFinite(cap) && cap > 0 ? cap : null;
						if (payoutCap != null) {
							const alreadyMatched = await sumMatchedIncomeForReservation(nextReservationId, {
								excludeTransactionId: id,
							});
							const nextTotal = alreadyMatched + txAmount;
							if (!isPayoutMatchAllowed(nextTotal, payoutCap)) {
								return res.status(400).json({
									error: `Match exceeds reservation payout (${nextTotal.toFixed(2)} > ${payoutCap.toFixed(2)}).`,
								});
							}
							if (nextTotal > payoutCap) {
								payoutAmountToStore = Math.max(payoutCap, nextTotal);
							}
						}
					}

					if (!nextReservationId) {
						splitsToStore = [];
					}
				}

				const data = await updateBankTransaction(id, {
					category,
					property_id,
					reviewed,
					hidden,
					notes,
					matched_reservation_id: reservationIdToStore,
					matched_payout_amount: payoutAmountToStore,
					reservation_splits: splitsToStore,
				});
				if (!data) return res.status(400).json({ error: 'No valid fields to update' });
				return res.json({ data });
			} catch (err) {
				console.error('Update bank transaction error:', err.message);
				return res.status(err.status || 502).json({ error: err.message });
			}
		}

		if (req.method === 'DELETE') {
			const tx = await getBankTransactionById(id);
			if (!tx) return res.status(404).json({ error: 'Transaction not found' });
			try {
				await assertCanEditOwnerStatementCashItem({
					property_id: tx.property_id,
					item_id: tx.id,
					item_source: 'bank',
					admin_password: req.body?.admin_password,
				});
			} catch (err) {
				return res.status(err.status || 403).json({ error: err.message });
			}
			await deleteBankTransaction(id);
			return res.status(204).end();
		}

		return res.status(405).end();
	}, { adminOnly: true });
}

async function validateSplitCapsForTx(transactionId, splits) {
	const incomeIds = [...new Set(
		splits.filter((s) => s.type === 'income').map((s) => s.reservation_id),
	)];
	const reservations = [];
	for (const reservationId of incomeIds) {
		const row = await getReservation(reservationId, { include: 'financials' });
		if (!row) continue;
		const fin = parseHostFinancials(row.financials?.host);
		reservations.push({
			id: row.id,
			code: row.code,
			revenue: fin.revenue,
			owner_payout: fin.revenue,
		});
	}
	const rows = await getBankTransactions({ limit: 5000 });
	return validateSplitPayoutCaps(splits, reservations, {
		excludeTransactionId: transactionId,
		existingRows: rows,
	});
}
