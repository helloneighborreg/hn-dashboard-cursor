import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Plus, Trash2 } from 'lucide-react';
import { fmt$ } from '../financials/format';
import {
	SPLIT_TYPES,
	getReservationSplits,
	splitsSum,
	validateReservationSplits,
} from '../../lib/reservationSplits';

const TYPE_OPTIONS = [
	{ value: SPLIT_TYPES.INCOME, label: 'Income' },
	{ value: SPLIT_TYPES.ADJUSTMENT, label: 'Adjustment / credit' },
];

function emptyRow() {
	return { reservation_id: '', amount: '', type: SPLIT_TYPES.INCOME };
}

export default function ReservationSplitEditor({
	tx,
	reservations,
	reservationById,
	initialRows,
	onSave,
	onCancel,
	saving,
}) {
	const [rows, setRows] = useState([]);
	const [error, setError] = useState('');
	const isBundledDraft = Boolean(initialRows?.some((r) => r.type === SPLIT_TYPES.ADJUSTMENT));

	useEffect(() => {
		const existing = getReservationSplits(tx);
		if (existing.length) {
			setRows(existing.map((s) => ({
				reservation_id: s.reservation_id,
				amount: String(s.amount),
				type: s.type,
			})));
		} else if (initialRows?.length) {
			setRows(initialRows.map((row) => ({
				reservation_id: row.reservation_id || '',
				amount: String(row.amount),
				type: row.type || SPLIT_TYPES.INCOME,
			})));
		} else {
			setRows([emptyRow()]);
		}
	}, [tx, initialRows]);

	const bankAmount = Number(tx.amount) || 0;
	const parsedRows = useMemo(() => rows.map((row) => ({
		reservation_id: row.reservation_id,
		amount: Number(row.amount),
		type: row.type,
	})), [rows]);
	const splitTotal = splitsSum(parsedRows.filter((r) => r.reservation_id && Number.isFinite(r.amount)));
	const remaining = bankAmount - splitTotal;

	const reservationOptions = useMemo(
		() => [...(reservations || [])].sort((a, b) => String(b.check_out).localeCompare(String(a.check_out))),
		[reservations],
	);

	function updateRow(index, patch) {
		setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
	}

	function addRow() {
		setRows((prev) => [...prev, emptyRow()]);
	}

	function removeRow(index) {
		setRows((prev) => (prev.length <= 1 ? [emptyRow()] : prev.filter((_, i) => i !== index)));
	}

	function handleSave() {
		setError('');
		const splits = rows
			.filter((row) => row.reservation_id && row.amount !== '')
			.map((row) => ({
				reservation_id: row.reservation_id,
				amount: Number(row.amount),
				type: row.type,
			}));
		const { error: validationError } = validateReservationSplits(splits, bankAmount);
		if (validationError) {
			setError(validationError);
			return;
		}
		onSave(splits);
	}

	return (
		<div className="pt-4 border-t border-border space-y-3">
			<div className="flex items-start justify-between gap-2">
				<div>
					<p className="text-xs font-semibold text-muted uppercase tracking-wide">
						Reservation splits
					</p>
					<p className="text-[11px] text-muted mt-0.5">
						One bank deposit can include income for one booking and an adjustment for another.
					</p>
				</div>
				<p className="text-xs tabular-nums text-right shrink-0">
					<span className="text-muted">Bank </span>
					<span className="font-semibold text-dark">{fmt$(bankAmount)}</span>
				</p>
			</div>

			{isBundledDraft && (
				<p className="text-xs text-brand-800 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2">
					This deposit is less than the selected payout — we pre-filled the income and adjustment amounts.
					Choose which reservation the adjustment applies to, then save.
				</p>
			)}

			<div className="space-y-2">
				{rows.map((row, index) => {
					const reservation = row.reservation_id ? reservationById[row.reservation_id] : null;
					return (
						<div key={index} className="grid grid-cols-[1fr_5.5rem_6.5rem_auto] gap-1.5 items-center">
							<select
								className="select-compact w-full min-w-0"
								value={row.reservation_id}
								onChange={(e) => updateRow(index, { reservation_id: e.target.value })}
							>
								<option value="">Reservation…</option>
								{reservationOptions.map((r) => (
									<option key={r.id} value={r.id}>
										{r.code} · {r.guest_name || 'Guest'}
									</option>
								))}
							</select>
							<select
								className="select-compact w-full"
								value={row.type}
								onChange={(e) => updateRow(index, { type: e.target.value })}
							>
								{TYPE_OPTIONS.map((opt) => (
									<option key={opt.value} value={opt.value}>{opt.label}</option>
								))}
							</select>
							<input
								type="number"
								step="0.01"
								className="input-compact w-full tabular-nums"
								placeholder="Amount"
								value={row.amount}
								onChange={(e) => updateRow(index, { amount: e.target.value })}
							/>
							<button
								type="button"
								onClick={() => removeRow(index)}
								className="p-1.5 rounded text-muted hover:text-red-600 hover:bg-red-50"
								aria-label="Remove split"
							>
								<Trash2 size={14} />
							</button>
							{reservation && (
								<p className="col-span-full text-[10px] text-muted -mt-1 pl-0.5">
									Payout {fmt$(reservation.revenue ?? reservation.owner_payout)}
								</p>
							)}
						</div>
					);
				})}
			</div>

			<button
				type="button"
				onClick={addRow}
				className="text-xs font-medium text-brand-600 hover:text-brand-700 inline-flex items-center gap-1"
			>
				<Plus size={14} />
				Add split
			</button>

			<div className={clsx(
				'text-xs tabular-nums rounded-lg px-3 py-2',
				Math.abs(remaining) <= 0.01 ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900',
			)}
			>
				Allocated {fmt$(splitTotal)} · Remaining {fmt$(remaining)}
			</div>

			{error && (
				<p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
					{error}
				</p>
			)}

			<div className="flex gap-2 pt-1">
				<button
					type="button"
					onClick={handleSave}
					disabled={saving}
					className="btn-primary text-xs flex-1"
				>
					Save splits
				</button>
				{onCancel && (
					<button type="button" onClick={onCancel} className="btn-secondary text-xs">
						Cancel
					</button>
				)}
			</div>
		</div>
	);
}
