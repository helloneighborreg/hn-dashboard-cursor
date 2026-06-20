import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, Link2 } from 'lucide-react';
import { fmt$ } from '../financials/format';
import { formatDateOrDash } from '../../lib/dates';
import {
	rankReservationMatches,
	reservationMatchLabel,
	describeMatchedDeposit,
} from '../../lib/reservationMatching';
import { getReservationSplits, splitSummaryLabel } from '../../lib/reservationSplits';

function reservationOptionText(reservation, { amountDiff } = {}) {
	const payout = reservation.revenue ?? reservation.owner_payout;
	const diff = amountDiff != null && amountDiff > 0.01
		? ` (${fmt$(amountDiff)} off)`
		: '';
	return `${reservation.code} · ${reservation.guest_name || 'Guest'} · ${fmt$(payout)} · ${formatDateOrDash(reservation.check_in)}–${formatDateOrDash(reservation.check_out)}${diff}`;
}

function MatchOption({ reservation, suggested, amountDiff, fullyMatched, remaining, kind, onPick }) {
	return (
		<button
			type="button"
			disabled={fullyMatched}
			onClick={() => onPick(reservation.id)}
			className={clsx(
				'w-full text-left text-xs px-2 py-1.5 rounded flex items-start gap-1.5',
				fullyMatched
					? 'opacity-40 cursor-not-allowed'
					: 'hover:bg-gray-50 text-dark',
			)}
		>
			{suggested ? (
				<Link2 size={12} className="text-brand-500 flex-shrink-0 mt-0.5" aria-hidden />
			) : (
				<span className="w-3 flex-shrink-0" aria-hidden />
			)}
			<span className="min-w-0 truncate">
				{kind === 'remainder' || kind === 'overflow_tail' ? (
					<span className="text-brand-600 font-medium">Continue match · </span>
				) : null}
				{reservationOptionText(reservation, { amountDiff })}
				{fullyMatched ? ' (fully matched)' : ''}
				{!fullyMatched && remaining != null && remaining > 0.01 ? ` · ${fmt$(remaining)} remaining` : ''}
			</span>
		</button>
	);
}

export default function ReservationMatchSelect({
	tx,
	reservations,
	reservationById,
	reservationRemainingById,
	reservationMatchedIncomeById,
	onChange,
	disabled,
}) {
	const [open, setOpen] = useState(false);
	const isDeposit = Number(tx.amount) > 0;

	const suggestions = useMemo(
		() => (isDeposit ? rankReservationMatches(tx, reservations, { reservationMatchedIncomeById }).slice(0, 8) : []),
		[tx, reservations, isDeposit, reservationMatchedIncomeById],
	);

	const suggestionIds = useMemo(
		() => new Set(suggestions.map((s) => s.reservation.id)),
		[suggestions],
	);

	const otherReservations = useMemo(() => {
		if (!isDeposit) return [];
		return [...(reservations || [])]
			.filter((r) => !suggestionIds.has(r.id))
			.sort((a, b) => {
				const aPartial = (reservationMatchedIncomeById?.get?.(a.id) || 0) > 0;
				const bPartial = (reservationMatchedIncomeById?.get?.(b.id) || 0) > 0;
				if (aPartial !== bPartial) return aPartial ? -1 : 1;
				return String(b.check_out).localeCompare(String(a.check_out));
			});
	}, [reservations, suggestionIds, isDeposit, reservationMatchedIncomeById]);

	if (!isDeposit) {
		return <span className="text-xs text-muted">—</span>;
	}

	const splits = getReservationSplits(tx);
	const matched = splits.length === 1
		? reservationById[splits[0].reservation_id]
		: null;

	function pick(id) {
		onChange(id || null);
		setOpen(false);
	}

	const triggerLabel = splits.length > 1
		? `${splitSummaryLabel(splits, reservationById)} (${splits.length} splits)`
		: matched
			? reservationOptionText(matched)
			: suggestions.length
				? 'Match payout…'
				: 'Select reservation…';

	return (
		<div className="relative min-w-[10rem] max-w-[14rem]">
			<button
				type="button"
				disabled={disabled}
				onClick={() => setOpen((v) => !v)}
				className={clsx(
					'select-compact w-full truncate flex items-center gap-1 text-left',
					!tx.matched_reservation_id && 'text-brand-600 font-medium',
					disabled && 'opacity-60',
				)}
			>
				{matched && splits.length <= 1 && (
					<Link2 size={12} className="text-brand-500 flex-shrink-0" aria-hidden />
				)}
				{splits.length > 1 && (
					<Link2 size={12} className="text-brand-500 flex-shrink-0" aria-hidden />
				)}
				<span className="truncate flex-1">{triggerLabel}</span>
				<ChevronDown size={12} className="text-muted flex-shrink-0" />
			</button>

			{open && (
				<>
					<button
						type="button"
						className="fixed inset-0 z-20"
						aria-label="Close menu"
						onClick={() => setOpen(false)}
					/>
					<div className="absolute left-0 top-full z-30 mt-1 w-[18rem] max-h-56 overflow-y-auto rounded-lg border border-border bg-white shadow-lg p-1.5">
						<button
							type="button"
							onClick={() => pick(null)}
							className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-gray-50 text-muted"
						>
							Clear match
						</button>
						{suggestions.length > 0 && (
							<>
								<p className="text-[10px] font-semibold text-muted uppercase tracking-wide px-2 pt-1.5 pb-0.5 flex items-center gap-1">
									<Link2 size={10} className="text-brand-500" />
									{suggestions.some((s) => s.kind === 'remainder' || s.kind === 'overflow_tail') ? 'Continue match' : 'Suggested'}
								</p>
								{suggestions.map(({ reservation, amountDiff, kind }) => (
									(() => {
										const remaining = reservationRemainingById?.get(reservation.id);
										const fullyMatched = remaining != null && remaining <= 0.01
											&& reservation.id !== tx.matched_reservation_id;
										return (
									<MatchOption
										key={reservation.id}
										reservation={reservation}
										suggested
										amountDiff={amountDiff}
										remaining={remaining}
										fullyMatched={fullyMatched}
										kind={kind}
										onPick={pick}
									/>
										);
									})()
								))}
							</>
						)}
						{otherReservations.length > 0 && (
							<>
								<p className="text-[10px] font-semibold text-muted uppercase tracking-wide px-2 pt-1.5 pb-0.5">
									All reservations
								</p>
								{otherReservations.map((reservation) => {
									const remaining = reservationRemainingById?.get(reservation.id);
									const fullyMatched = remaining != null && remaining <= 0.01
										&& reservation.id !== tx.matched_reservation_id;
									return (
									<MatchOption
										key={reservation.id}
										reservation={reservation}
										remaining={remaining}
										fullyMatched={fullyMatched}
										onPick={pick}
									/>
									);
								})}
							</>
						)}
					</div>
				</>
			)}

			{matched && splits.length === 1 && (() => {
				const summary = describeMatchedDeposit(tx, matched, reservationMatchedIncomeById);
				if (summary.type === 'full') {
					return (
						<p className="text-[10px] text-muted mt-0.5 truncate">
							{fmt$(summary.payout)} payout
						</p>
					);
				}
				if (summary.type === 'partial') {
					return (
						<p className="text-[10px] text-muted mt-0.5 truncate">
							{fmt$(summary.txAmount)} of {fmt$(summary.payout)} payout
							{summary.remaining > 0.01 && (
								<span className="text-amber-700"> · {fmt$(summary.remaining)} remaining</span>
							)}
						</p>
					);
				}
				return (
					<p className="text-[10px] text-muted mt-0.5 truncate">
						{fmt$(summary.payout)} payout
						{summary.diff > 0.01 && (
							<span className="text-amber-700"> · {fmt$(summary.diff)} vs bank</span>
						)}
					</p>
				);
			})()}

			{splits.length > 1 && (
				<p className="text-[10px] text-muted mt-0.5 truncate">
					{splits.map((s) => {
						const r = reservationById[s.reservation_id];
						const code = r?.code || '—';
						const sign = s.type === 'adjustment' ? 'adj' : 'inc';
						return `${code} ${sign} ${fmt$(s.amount)}`;
					}).join(' · ')}
				</p>
			)}
		</div>
	);
}
