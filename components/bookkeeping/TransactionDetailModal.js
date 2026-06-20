import { X, CalendarDays, CreditCard, FileText, Tag, Home, CheckCircle2, EyeOff, Link2, Hash } from 'lucide-react';
import clsx from 'clsx';
import { fmt$ } from '../financials/format';
import { formatDateOrDash } from '../../lib/dates';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { useFocusTrap } from '../../lib/useFocusTrap';
import { CategoryTypeBadge } from './CategorySelect';
import { categoryLabel } from '../../lib/bookkeepingCategories';
import { describeMatchedDeposit } from '../../lib/reservationMatching';
import { getReservationSplits } from '../../lib/reservationSplits';
import ReservationSplitEditor from './ReservationSplitEditor';

function DetailRow({ icon: Icon, label, value, mono = false }) {
	return (
		<div className="flex items-start gap-3">
			<div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
				<Icon size={14} className="text-muted" />
			</div>
			<div className="min-w-0">
				<p className="text-xs text-muted leading-none mb-0.5">{label}</p>
				<p className={clsx(
					'text-sm leading-snug break-words',
					mono && 'font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded inline-block',
				)}>
					{value ?? '—'}
				</p>
			</div>
		</div>
	);
}

function SplitLineSummary({ split, reservation, reservationMatchedIncomeById }) {
	const pseudoTx = {
		amount: split.amount,
		matched_payout_amount: reservation?.revenue ?? reservation?.owner_payout,
	};
	const summary = describeMatchedDeposit(pseudoTx, reservation, reservationMatchedIncomeById);
	const typeLabel = split.type === 'adjustment' ? 'Adjustment' : 'Income';

	return (
		<div className="rounded-lg border border-border px-3 py-2 space-y-1">
			<p className="text-sm font-medium text-dark">
				{reservation?.code || '—'} · {reservation?.guest_name || 'Guest'}
			</p>
			<p className="text-xs text-muted">
				{typeLabel} · <span className={split.amount < 0 ? 'text-red-600' : 'text-green-600'}>{fmt$(split.amount)}</span>
			</p>
			{split.type === 'income' && summary.type === 'partial' && (
				<p className="text-[10px] text-muted">
					{fmt$(summary.txAmount)} of {fmt$(summary.payout)} payout
					{summary.remaining > 0.01 && ` · ${fmt$(summary.remaining)} remaining`}
				</p>
			)}
		</div>
	);
}

export default function TransactionDetailModal({
	tx,
	onClose,
	propertyNameById = {},
	reservationById = {},
	reservations = [],
	reservationMatchedIncomeById,
	initialSplitRows,
	onSaveSplits,
	saving = false,
	onToggleExcluded,
}) {
	useEscapeKey(onClose);
	const dialogRef = useFocusTrap();
	if (!tx) return null;

	const splits = getReservationSplits(tx);
	const isDeposit = Number(tx.amount) > 0;
	const propertyName = tx.property_id
		? (propertyNameById[tx.property_id] || tx.property_id)
		: null;

	return (
		<>
			<div
				className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
				onClick={onClose}
			/>
			<div
				ref={dialogRef}
				tabIndex={-1}
				role="dialog"
				aria-modal="true"
				aria-label="Transaction details"
				className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden focus:outline-none"
			>
				<div className="flex items-center justify-between px-5 py-4 border-b border-border">
					<div className="min-w-0">
						<p className="font-semibold text-dark text-sm leading-snug truncate">
							Transaction details
						</p>
						<p className="text-xs text-muted truncate">
							{formatDateOrDash(tx.date)} · {tx.account || 'Bank account'}
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close"
						className="text-muted hover:text-dark p-1 rounded-lg hover:bg-gray-100 flex-shrink-0"
					>
						<X size={18} />
					</button>
				</div>

				<div className="flex-1 overflow-y-auto p-5 space-y-5">
					<div className="flex items-center gap-2 flex-wrap">
						<span className={clsx(
							'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
							Number(tx.amount) >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
						)}>
							{fmt$(Number(tx.amount))}
						</span>
						{tx.pending && (
							<span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
								Pending
							</span>
						)}
						{tx.hidden && (
							<span className="inline-flex items-center gap-1 text-xs font-medium text-muted bg-gray-100 px-2 py-0.5 rounded-full">
								<EyeOff size={12} />
								Excluded from reports
							</span>
						)}
						<span className={clsx(
							'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
							tx.reviewed ? 'text-green-700 bg-green-50' : 'text-muted bg-gray-100',
						)}>
							<CheckCircle2 size={12} />
							{tx.reviewed ? 'Reviewed' : 'Needs review'}
						</span>
					</div>

					<div className="space-y-3">
						<DetailRow icon={CalendarDays} label="Date" value={formatDateOrDash(tx.date)} />
						<DetailRow icon={FileText} label="Description" value={tx.description || '—'} />
						<DetailRow icon={CreditCard} label="Account" value={tx.account || '—'} />
						<DetailRow
							icon={Tag}
							label="Category"
							value={tx.category ? (
								<span className="inline-flex flex-wrap items-center gap-2">
									<CategoryTypeBadge category={tx.category} />
									<span className="font-medium text-dark">{categoryLabel(tx.category)}</span>
								</span>
							) : '—'}
						/>
						<DetailRow icon={Home} label="Property" value={propertyName || '—'} />
						<DetailRow icon={FileText} label="Notes" value={tx.notes?.trim() ? tx.notes.trim() : '—'} />
					</div>

					{isDeposit && splits.length > 1 && !onSaveSplits && (
						<div className="pt-4 border-t border-border space-y-2">
							<p className="text-xs font-semibold text-muted uppercase tracking-wide">
								Reservation splits
							</p>
							{splits.map((split) => (
								<SplitLineSummary
									key={`${split.reservation_id}-${split.type}-${split.amount}`}
									split={split}
									reservation={reservationById[split.reservation_id]}
									reservationMatchedIncomeById={reservationMatchedIncomeById}
								/>
							))}
						</div>
					)}

					{isDeposit && onSaveSplits && (
						<ReservationSplitEditor
							tx={tx}
							reservations={reservations}
							reservationById={reservationById}
							initialRows={initialSplitRows}
							onSave={onSaveSplits}
							saving={saving}
						/>
					)}
				</div>

				{onToggleExcluded && (
					<div className="shrink-0 border-t border-border px-5 py-4">
						<button
							type="button"
							onClick={() => onToggleExcluded(!tx.hidden)}
							className="btn-secondary w-full text-sm gap-2 inline-flex items-center justify-center"
						>
							<EyeOff size={16} />
							{tx.hidden ? 'Include in reports' : 'Exclude from reports'}
						</button>
					</div>
				)}
			</div>
		</>
	);
}
