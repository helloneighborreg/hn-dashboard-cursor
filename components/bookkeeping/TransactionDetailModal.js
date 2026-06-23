import { useEffect, useState } from 'react';
import { X, Pencil, Trash2, CalendarDays, CreditCard, FileText, Tag, Home, CheckCircle2, EyeOff } from 'lucide-react';
import clsx from 'clsx';
import { fmt$ } from '../financials/format';
import { formatDateOrDash } from '../../lib/dates';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { useFocusTrap } from '../../lib/useFocusTrap';
import CategorySelect, { CategoryTypeBadge } from './CategorySelect';
import { categoryLabel } from '../../lib/bookkeepingCategories';
import { describeMatchedDeposit } from '../../lib/reservationMatching';
import { getReservationSplits } from '../../lib/reservationSplits';
import ReservationSplitEditor from './ReservationSplitEditor';
import { InlineSelect } from './BookkeepingControls';

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

function buildEditForm(tx) {
	return {
		category: tx?.category || '',
		property_id: tx?.property_id || '',
		notes: tx?.notes || '',
	};
}

export default function TransactionDetailModal({
	tx,
	onClose,
	propertyNameById = {},
	propertyOptions = [],
	reservationById = {},
	reservations = [],
	reservationMatchedIncomeById,
	initialSplitRows,
	onSaveSplits,
	saving = false,
	onToggleExcluded,
	onSave,
	onDeleted,
}) {
	const [editing, setEditing] = useState(false);
	const [form, setForm] = useState(() => buildEditForm(tx));
	const [editSaving, setEditSaving] = useState(false);
	const [editErr, setEditErr] = useState('');
	const [deleting, setDeleting] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);

	useEscapeKey(onClose);
	const dialogRef = useFocusTrap();

	useEffect(() => {
		setForm(buildEditForm(tx));
		setEditing(false);
		setEditErr('');
		setConfirmDelete(false);
	}, [tx]);

	if (!tx) return null;

	const splits = getReservationSplits(tx);
	const isDeposit = Number(tx.amount) > 0;
	const propertyName = tx.property_id
		? (propertyNameById[tx.property_id] || tx.property_id)
		: null;
	const canEdit = Boolean(onSave);

	function cancelEdit() {
		setForm(buildEditForm(tx));
		setEditing(false);
		setEditErr('');
	}

	async function saveEdit(e) {
		e.preventDefault();
		if (!onSave) return;
		setEditErr('');
		setEditSaving(true);
		try {
			await onSave({
				category: form.category || null,
				property_id: form.property_id || null,
				notes: form.notes,
			});
			setEditing(false);
		} catch (error) {
			setEditErr(error.message);
		} finally {
			setEditSaving(false);
		}
	}

	async function remove() {
		if (!onDeleted) return;
		setEditErr('');
		setDeleting(true);
		try {
			await onDeleted(tx.id);
			onClose?.();
		} catch (error) {
			setEditErr(error.message);
			setConfirmDelete(false);
		} finally {
			setDeleting(false);
		}
	}

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
							{editing ? 'Edit transaction' : 'Transaction details'}
						</p>
						<p className="text-xs text-muted truncate">
							{formatDateOrDash(tx.date)} · {tx.account || 'Bank account'}
						</p>
					</div>
					<div className="flex items-center gap-1 flex-shrink-0">
						{canEdit && !editing && (
							<button
								type="button"
								onClick={() => setEditing(true)}
								aria-label="Edit transaction"
								className="text-muted hover:text-dark p-1 rounded-lg hover:bg-gray-100"
							>
								<Pencil size={16} />
							</button>
						)}
						<button
							type="button"
							onClick={onClose}
							aria-label="Close"
							className="text-muted hover:text-dark p-1 rounded-lg hover:bg-gray-100"
						>
							<X size={18} />
						</button>
					</div>
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

					{editing ? (
						<form id="bank-tx-edit-form" onSubmit={saveEdit} className="space-y-4">
							<DetailRow icon={CalendarDays} label="Date" value={formatDateOrDash(tx.date)} />
							<DetailRow icon={FileText} label="Description" value={tx.description || '—'} />
							<DetailRow icon={CreditCard} label="Account" value={tx.account || '—'} />
							<div>
								<label className="label">Category</label>
								<CategorySelect
									value={form.category}
									onChange={(category) => setForm((f) => ({ ...f, category }))}
									placeholder="Select category…"
									className="select w-full max-w-none"
								/>
							</div>
							<div>
								<label className="label">Property</label>
								<InlineSelect
									value={form.property_id}
									placeholder="Select property"
									options={propertyOptions}
									onChange={(propertyId) => setForm((f) => ({ ...f, property_id: propertyId }))}
									className="w-full max-w-none"
								/>
							</div>
							<div>
								<label className="label">Notes</label>
								<textarea
									className="input resize-none"
									rows={3}
									placeholder="Optional notes…"
									value={form.notes}
									onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
								/>
							</div>
							{editErr && <p className="text-red-600 text-sm">{editErr}</p>}
						</form>
					) : (
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
					)}

					{!editing && isDeposit && splits.length > 1 && !onSaveSplits && (
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

					{!editing && isDeposit && onSaveSplits && (
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

				{(editing || onToggleExcluded || onDeleted) && (
					<div className="shrink-0 border-t border-border px-5 py-4 space-y-3">
						{editing && (
							<div className="flex gap-3">
								<button type="button" onClick={cancelEdit} className="btn-secondary flex-1 justify-center">
									Cancel
								</button>
								<button
									type="submit"
									form="bank-tx-edit-form"
									disabled={editSaving || saving}
									className={clsx('btn-primary flex-1 justify-center', (editSaving || saving) && 'opacity-60')}
								>
									{editSaving || saving ? 'Saving…' : 'Save changes'}
								</button>
							</div>
						)}
						{onToggleExcluded && !editing && (
							<button
								type="button"
								onClick={() => onToggleExcluded(!tx.hidden)}
								className="btn-secondary w-full text-sm gap-2 inline-flex items-center justify-center"
							>
								<EyeOff size={16} />
								{tx.hidden ? 'Include in reports' : 'Exclude from reports'}
							</button>
						)}
						{onDeleted && !editing && (
							confirmDelete ? (
								<div className="space-y-2">
									<p className="text-sm text-amber-800">
										Delete this transaction? Synced bank transactions may reappear after the next bank sync.
									</p>
									<div className="flex gap-3">
										<button
											type="button"
											onClick={() => setConfirmDelete(false)}
											disabled={deleting}
											className="btn-secondary flex-1 justify-center"
										>
											Cancel
										</button>
										<button
											type="button"
											onClick={remove}
											disabled={deleting}
											className={clsx('btn-danger flex-1 justify-center', deleting && 'opacity-60')}
										>
											{deleting ? 'Deleting…' : 'Delete'}
										</button>
									</div>
								</div>
							) : (
								<button
									type="button"
									onClick={() => setConfirmDelete(true)}
									className="btn-secondary w-full text-sm gap-2 inline-flex items-center justify-center text-red-600 hover:text-red-700 hover:bg-red-50"
								>
									<Trash2 size={16} />
									Delete transaction
								</button>
							)
						)}
						{editErr && !editing && <p className="text-red-600 text-sm">{editErr}</p>}
					</div>
				)}
			</div>
		</>
	);
}
