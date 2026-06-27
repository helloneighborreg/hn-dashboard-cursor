import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { X, EyeOff, Pencil, Trash2, Check, Circle } from 'lucide-react';
import clsx from 'clsx';
import DateInput from '../DateInput';
import CategorySelect from '../bookkeeping/CategorySelect';
import { InlineSelect } from '../bookkeeping/BookkeepingControls';
import { fmtReport$ } from '../financials/format';
import { formatDateOrDash } from '../../lib/dates';
import { getPropertyDisplayName } from '../../lib/codes';
import { categoryLabel } from '../../lib/bookkeepingCategories';
import { buildOwnerStatementWaterfall } from '../../lib/ownerStatementReport';
import OwnerStatementMonthPicker from './OwnerStatementMonthPicker';
import {
	canDeleteTransaction,
	canEditTransaction,
	canExcludeTransaction,
	deleteDrilldownTransaction,
	patchDrilldownTransaction,
} from '../../lib/bookkeepingClient';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { useFocusTrap } from '../../lib/useFocusTrap';

function rowKey(row) {
	return `${row.source}-${row.id}`;
}

function buildDraft(row) {
	return {
		date: row.date || '',
		vendor: row.description || '',
		property_id: row.property_id || '',
		category: row.category || '',
		amount: String(Math.abs(Number(row.amount) || 0)),
	};
}

function buildPatch(row, draft) {
	if (row.source === 'manual') {
		const patch = {};
		if (draft.date !== row.date) patch.date = draft.date;
		if (draft.vendor !== (row.description || '')) patch.vendor = draft.vendor;
		if (draft.property_id !== (row.property_id || '')) patch.property_id = draft.property_id || null;
		if (draft.category !== (row.category || '')) patch.category = draft.category;
		const amount = parseFloat(draft.amount);
		const current = Math.abs(Number(row.amount) || 0);
		if (Number.isFinite(amount) && amount !== current) patch.amount = amount;
		return patch;
	}

	const patch = {};
	if (draft.property_id !== (row.property_id || '')) patch.property_id = draft.property_id || null;
	if (draft.category !== (row.category || '')) patch.category = draft.category;
	return patch;
}

function AmountCell({ amount, className }) {
	const n = Number(amount) || 0;
	return (
		<span className={clsx(
			'tabular-nums font-medium',
			n > 0 ? 'text-green-600' : n < 0 ? 'text-red-600' : 'text-dark',
			className,
		)}
		>
			{fmtReport$(n)}
		</span>
	);
}

function BreakdownAmount({ amount, bold, signed }) {
	const n = Number(amount) || 0;
	const display = signed && n !== 0
		? (n < 0 ? `−${fmtReport$(Math.abs(n))}` : fmtReport$(n))
		: fmtReport$(n);

	return (
		<span className={clsx(
			'tabular-nums text-dark shrink-0',
			bold ? 'text-base font-semibold' : 'text-sm font-normal',
		)}
		>
			{display}
		</span>
	);
}

function DetailRow({ label, value, children }) {
	return (
		<div className="flex items-baseline justify-between gap-4 py-2">
			<span className="text-sm text-muted">{label}</span>
			{children || (
				<span className="text-sm text-dark text-right">{value || '—'}</span>
			)}
		</div>
	);
}

function WaterfallLine({ line }) {
	return (
		<div className="flex items-baseline justify-between gap-4 py-2.5">
			<span className="text-sm text-dark">{line.label}</span>
			<BreakdownAmount amount={line.amount} signed={line.signed} />
		</div>
	);
}

function InclusionStatus({ included, statementMonthLabel }) {
	if (included) {
		return (
			<span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700">
				<Check size={16} className="shrink-0" aria-hidden />
				Complete{statementMonthLabel ? ` · ${statementMonthLabel}` : ''}
			</span>
		);
	}

	return (
		<span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600">
			<Circle size={10} className="shrink-0 fill-current" aria-hidden />
			Incomplete
		</span>
	);
}

function WaterfallSection({
	title,
	lines,
	totalLabel,
	totalAmount,
	footerLabel,
	footerAmount,
	emphasizeTotal,
}) {
	return (
		<section className={clsx(title ? 'mt-6' : 'mt-0')}>
			{title && (
				<h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
					{title}
				</h3>
			)}
			{lines.length > 0 && (
				<div className="space-y-0">
					{lines.map((line) => (
						<WaterfallLine key={line.label} line={line} />
					))}
				</div>
			)}
			{footerAmount != null && (
				<div className={clsx(
					'flex items-baseline gap-4 border-t border-border',
					footerLabel ? 'justify-between' : 'justify-end',
					lines.length > 0 ? 'mt-2 pt-3' : 'pt-1',
				)}
				>
					{footerLabel && (
						<span className="text-sm font-semibold text-dark">{footerLabel}</span>
					)}
					<BreakdownAmount amount={footerAmount} bold />
				</div>
			)}
			{totalAmount != null && (
				<div className={clsx(
					'flex items-baseline gap-4 border-t border-border',
					totalLabel ? 'justify-between' : 'justify-end',
					lines.length > 0 ? 'mt-2 pt-3' : 'pt-1',
					emphasizeTotal && 'pb-1',
				)}
				>
					{totalLabel && (
						<span className={clsx(
							'text-sm font-semibold text-dark',
							emphasizeTotal && 'text-base',
						)}
						>
							{totalLabel}
						</span>
					)}
					<BreakdownAmount amount={totalAmount} bold={emphasizeTotal || !totalLabel} />
				</div>
			)}
		</section>
	);
}

function OwnerStatementNotesSection({ notes, onSave, saving, locked, onUnlock, unlocking }) {
	const [draft, setDraft] = useState(notes || '');
	const [saved, setSaved] = useState(false);

	useEffect(() => {
		setDraft(notes || '');
		setSaved(false);
	}, [notes]);

	const dirty = draft !== (notes || '');

	async function handleSave() {
		try {
			await onSave?.(draft);
			setSaved(true);
		} catch {
			setSaved(false);
		}
	}

	return (
		<section className="mt-6">
			<div className="flex items-center justify-between gap-3 mb-2">
				<h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
					Notes
				</h3>
				{locked && (
					<button
						type="button"
						onClick={onUnlock}
						disabled={unlocking}
						className="text-xs font-medium text-brand-600 hover:text-brand-700"
					>
						{unlocking ? 'Unlocking…' : 'Unlock to edit'}
					</button>
				)}
			</div>
			<div className="border-t border-border pt-3 pb-1">
				<textarea
					value={draft}
					onChange={(e) => {
						setDraft(e.target.value);
						setSaved(false);
					}}
					rows={4}
					readOnly={locked}
					placeholder={locked ? 'Notes are locked while this reservation is on an owner statement.' : 'Add notes for this reservation…'}
					className={clsx(
						'w-full text-sm text-dark border border-border rounded-md px-3 py-2 resize-y min-h-[5rem] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary',
						locked && 'bg-gray-50 text-muted cursor-not-allowed',
					)}
				/>
				{!locked && (
					<div className="mt-2 flex items-center justify-end gap-2">
						{saved && !dirty && (
							<span className="text-xs font-medium text-green-700">Saved</span>
						)}
						<button
							type="button"
							onClick={handleSave}
							disabled={saving || !dirty}
							className="btn-primary text-sm"
						>
							{saving ? 'Saving…' : 'Save'}
						</button>
					</div>
				)}
			</div>
		</section>
	);
}

function OwnerStatementBreakdownDetail({
	row,
	onSaveNotes,
	savingNotes,
	locked,
	onUnlock,
	unlocking,
}) {
	const nights = Number(row.nights) || 0;
	const datesLabel = [row.date_range, nights ? `${nights} night${nights === 1 ? '' : 's'}` : null]
		.filter(Boolean)
		.join(' · ');
	const { sections } = buildOwnerStatementWaterfall(row);

	return (
		<div className="px-5 py-4">
			<div className="space-y-0">
				<DetailRow label="Reservation ID" value={row.code || row.id} />
				<DetailRow label="Guest" value={row.guest_name || row.code} />
				<DetailRow label="Dates" value={datesLabel} />
				{row.property_name && <DetailRow label="Property" value={row.property_name} />}
			</div>

			<div className="mt-6">
				{sections.map((section, index) => (
					<Fragment key={section.key || section.title || index}>
						{section.key === 'due-to-manager' && onSaveNotes && (
							<OwnerStatementNotesSection
								notes={row.statement_notes}
								onSave={(notes) => onSaveNotes(row, notes)}
								saving={savingNotes}
								locked={locked}
								onUnlock={onUnlock}
								unlocking={unlocking}
							/>
						)}
						<WaterfallSection
							title={section.title}
							lines={section.lines}
							totalLabel={section.totalLabel}
							totalAmount={section.totalAmount}
							footerLabel={section.footerLabel}
							footerAmount={section.footerAmount}
							emphasizeTotal={index === sections.length - 1}
						/>
					</Fragment>
				))}
			</div>
		</div>
	);
}

function OwnerStatementBreakdownTable({
	items,
	onSaveNotes,
	savingNotes,
	isReservationLocked,
	onRequestUnlock,
}) {
	const [unlockingId, setUnlockingId] = useState(null);

	if (items.length === 1) {
		const row = items[0];
		const locked = isReservationLocked?.(row) ?? false;

		async function handleUnlock() {
			setUnlockingId(row.id);
			try {
				await onRequestUnlock?.(row, {
					title: 'Unlock to edit notes',
					description: 'This reservation is on an owner statement. Enter an admin password to edit notes.',
				});
			} finally {
				setUnlockingId(null);
			}
		}

		return (
			<OwnerStatementBreakdownDetail
				row={row}
				onSaveNotes={onSaveNotes}
				savingNotes={savingNotes}
				locked={locked}
				onUnlock={handleUnlock}
				unlocking={unlockingId === row.id}
			/>
		);
	}

	return (
		<div className="divide-y divide-border">
			{items.map((row) => (
				<OwnerStatementBreakdownDetail key={row.id} row={row} />
			))}
		</div>
	);
}

function DrilldownTransactionRow({
	row,
	propertyOptions,
	isEditing,
	draft,
	onDraftChange,
	onStartEdit,
	onExclude,
	onRequestDelete,
	excludingId,
	deletingId,
	rowRef,
}) {
	const editable = canEditTransaction(row);
	const deletable = canDeleteTransaction(row);
	const isManual = row.source === 'manual';

	return (
		<tr
			ref={isEditing ? rowRef : null}
			className={clsx('hover:bg-gray-50 group', isEditing && 'bg-brand-50/30')}
		>
			<td className="table-cell-date">
				{isEditing && isManual ? (
					<DateInput
						className="input-compact w-[7.5rem]"
						value={draft.date}
						onChange={(e) => onDraftChange({ date: e.target.value })}
					/>
				) : (
					formatDateOrDash(row.date)
				)}
			</td>
			<td className="table-cell max-w-[12rem]">
				{isEditing && isManual ? (
					<input
						type="text"
						className="input-compact w-full min-w-[8rem]"
						value={draft.vendor}
						placeholder="Vendor"
						onChange={(e) => onDraftChange({ vendor: e.target.value })}
					/>
				) : (
					<span className="truncate block" title={row.description}>{row.description || '—'}</span>
				)}
			</td>
			<td className="table-cell max-w-[10rem]">
				{isEditing && editable ? (
					<InlineSelect
						value={draft.property_id}
						placeholder="Property"
						options={propertyOptions}
						className="max-w-[10rem] w-full"
						onChange={(propertyId) => onDraftChange({ property_id: propertyId })}
					/>
				) : (
					<span className="truncate block">{row.property_name || '—'}</span>
				)}
			</td>
			<td className="table-cell max-w-[11rem]">
				{isEditing && editable ? (
					<CategorySelect
						value={draft.category}
						placeholder="Category"
						className="select-compact w-full max-w-[11rem]"
						onChange={(category) => onDraftChange({ category })}
					/>
				) : (
					<span className="truncate block">{categoryLabel(row.category) || '—'}</span>
				)}
			</td>
			<td className="table-cell font-mono text-xs">{row.reservation_code || '—'}</td>
			<td className="table-cell text-right">
				{isEditing && isManual ? (
					<input
						type="number"
						step="0.01"
						min="0"
						className="input-compact w-24 text-right ml-auto"
						value={draft.amount}
						onChange={(e) => onDraftChange({ amount: e.target.value })}
					/>
				) : (
					<AmountCell amount={row.displayAmount ?? row.reportAmount ?? row.amount} />
				)}
			</td>
			<td className="table-cell text-right w-20">
				<div className="inline-flex items-center gap-1 justify-end">
					{editable && !isEditing && (
						<button
							type="button"
							onClick={onStartEdit}
							className="p-1 rounded-md text-muted opacity-0 group-hover:opacity-100 hover:text-dark hover:bg-gray-100 transition-colors"
							title="Edit transaction"
							aria-label="Edit transaction"
						>
							<Pencil size={14} />
						</button>
					)}
					{onExclude && canExcludeTransaction(row) && !isEditing && (
						<button
							type="button"
							onClick={() => onExclude(row)}
							disabled={excludingId === row.id}
							className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-dark disabled:opacity-50 p-1"
							title="Exclude from reports"
						>
							<EyeOff size={14} />
						</button>
					)}
					{onRequestDelete && deletable && !isEditing && (
						<button
							type="button"
							onClick={() => onRequestDelete(row)}
							disabled={deletingId === row.id}
							className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-red-600 disabled:opacity-50 p-1"
							title="Delete transaction"
							aria-label="Delete transaction"
						>
							<Trash2 size={14} />
						</button>
					)}
				</div>
			</td>
		</tr>
	);
}

export default function ReportDrilldownPanel({
	title,
	subtitle,
	items,
	properties = [],
	onClose,
	onItemUpdated,
	variant = 'transactions',
	onExcludeItem,
	excludingId,
	onToggleInclusion,
	togglingId,
	onSaveNotes,
	savingNotesId,
	openMonthPicker = false,
	isReservationLocked,
	onRequestUnlock,
	stacked = false,
}) {
	const [saving, setSaving] = useState(false);
	const [editingKey, setEditingKey] = useState(null);
	const [draft, setDraft] = useState(null);
	const [error, setError] = useState('');
	const [showMonthPicker, setShowMonthPicker] = useState(false);
	const [pendingDelete, setPendingDelete] = useState(null);
	const [deleting, setDeleting] = useState(false);
	const editingRowRef = useRef(null);
	const footerRef = useRef(null);

	useEscapeKey(onClose);
	const dialogRef = useFocusTrap(Boolean(title));

	const propertyOptions = useMemo(
		() => properties.map((p) => ({
			value: p.id,
			label: getPropertyDisplayName(p) || p.name,
		})),
		[properties],
	);

	const editingRow = useMemo(
		() => (items || []).find((row) => rowKey(row) === editingKey) || null,
		[items, editingKey],
	);

	useEffect(() => {
		setShowMonthPicker(Boolean(openMonthPicker));
	}, [openMonthPicker, items?.[0]?.id]);

	useEffect(() => {
		if (!editingKey) return undefined;

		function handleMouseDown(e) {
			if (editingRowRef.current?.contains(e.target)) return;
			if (footerRef.current?.contains(e.target)) return;
			setEditingKey(null);
			setDraft(null);
			setError('');
		}

		document.addEventListener('mousedown', handleMouseDown);
		return () => document.removeEventListener('mousedown', handleMouseDown);
	}, [editingKey]);

	if (!title) return null;

	const total = (items || []).reduce((sum, item) => sum + (Number(item.displayAmount ?? item.amount) || 0), 0);

	function startEdit(row) {
		setEditingKey(rowKey(row));
		setDraft(buildDraft(row));
		setError('');
	}

	function cancelEdit() {
		setEditingKey(null);
		setDraft(null);
		setError('');
	}

	function updateDraft(partial) {
		setDraft((prev) => (prev ? { ...prev, ...partial } : prev));
	}

	async function saveEdit() {
		if (!editingRow || !draft) return;

		if (editingRow.source === 'manual') {
			if (!draft.property_id || !draft.category || !draft.amount) {
				setError('Property, category, and amount are required');
				return;
			}
		}

		const patch = buildPatch(editingRow, draft);
		if (!Object.keys(patch).length) {
			cancelEdit();
			return;
		}

		setSaving(true);
		setError('');
		try {
			await patchDrilldownTransaction(editingRow, patch, properties);
			await onItemUpdated?.();
			onClose();
		} catch (err) {
			setError(err.message);
		} finally {
			setSaving(false);
		}
	}

	async function confirmDelete() {
		if (!pendingDelete) return;
		setDeleting(true);
		setError('');
		try {
			await deleteDrilldownTransaction(pendingDelete);
			setPendingDelete(null);
			await onItemUpdated?.();
			onClose();
		} catch (err) {
			setError(err.message);
		} finally {
			setDeleting(false);
		}
	}

	const deletingId = deleting && pendingDelete ? pendingDelete.id : null;

	return (
		<>
			<div
				className={clsx(
					'fixed inset-0 bg-black/30 backdrop-blur-[1px]',
					stacked ? 'z-[120]' : 'z-40',
				)}
				onClick={onClose}
			/>
			<div
				ref={dialogRef}
				tabIndex={-1}
				role="dialog"
				aria-modal="true"
				aria-label={title}
				className={clsx(
					'fixed inset-y-0 right-0 w-full bg-white shadow-2xl flex flex-col overflow-hidden focus:outline-none',
					stacked ? 'z-[130]' : 'z-50',
					variant === 'owner-statement' ? 'max-w-md' : 'max-w-3xl',
				)}
			>
				<div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
					<div className="min-w-0">
						<h2 className="text-lg font-bold text-dark">{title}</h2>
						{subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
						{error && <p className="text-xs text-red-600 mt-1">{error}</p>}
					</div>
					<button
						type="button"
						onClick={onClose}
						className="p-2 rounded-lg text-muted hover:text-dark hover:bg-gray-100"
						aria-label="Close"
					>
						<X size={18} />
					</button>
				</div>

				<div className="flex-1 overflow-y-auto">
					{!items?.length ? (
						<p className="p-8 text-center text-sm text-muted">No transactions for this amount.</p>
					) : variant === 'owner-statement' ? (
						<OwnerStatementBreakdownTable
							items={items}
							onSaveNotes={onSaveNotes}
							savingNotes={savingNotesId === items?.[0]?.id}
							isReservationLocked={isReservationLocked}
							onRequestUnlock={onRequestUnlock}
						/>
					) : variant === 'reservations' ? (
						<table className="w-full text-sm">
							<thead className="sticky top-0 bg-gray-50 border-b border-border">
								<tr>
									<th className="table-head">Property</th>
									<th className="table-head">Guest</th>
									<th className="table-head-date">Check-in</th>
									<th className="table-head-date">Check-out</th>
									<th className="table-head text-right">Amount</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{items.map((row) => (
									<tr key={row.id} className="hover:bg-gray-50">
										<td className="table-cell">{row.property_name}</td>
										<td className="table-cell">{row.guest_name || row.code}</td>
										<td className="table-cell-date">{formatDateOrDash(row.check_in)}</td>
										<td className="table-cell-date">{formatDateOrDash(row.check_out)}</td>
										<td className="table-cell text-right">
											<AmountCell amount={row.displayAmount} />
										</td>
									</tr>
								))}
							</tbody>
						</table>
					) : (
						<table className="w-full text-sm">
							<thead className="sticky top-0 bg-gray-50 border-b border-border">
								<tr>
									<th className="table-head-date">Date</th>
									<th className="table-head">Description</th>
									<th className="table-head">Property</th>
									<th className="table-head">Category</th>
									<th className="table-head">Reservation</th>
									<th className="table-head text-right">Amount</th>
									<th className="table-head w-20" />
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{items.map((row) => {
									const key = rowKey(row);
									const isEditing = editingKey === key;
									return (
										<DrilldownTransactionRow
											key={key}
											row={row}
											propertyOptions={propertyOptions}
											isEditing={isEditing}
											draft={isEditing ? draft : null}
											onDraftChange={updateDraft}
											onStartEdit={() => startEdit(row)}
											onExclude={onExcludeItem}
											onRequestDelete={(target) => {
												setPendingDelete(target);
												setError('');
											}}
											excludingId={excludingId}
											deletingId={deletingId}
											rowRef={editingRowRef}
										/>
									);
								})}
							</tbody>
						</table>
					)}
				</div>

				{variant === 'owner-statement' && items?.length === 1 && onToggleInclusion && (
					<div
						ref={footerRef}
						className="shrink-0 border-t border-border px-5 py-3 flex flex-col gap-3 bg-white"
					>
						{showMonthPicker ? (
							<OwnerStatementMonthPicker
								selectedMonth={items[0].statement_month}
								onSelect={(statementMonth) => {
									setShowMonthPicker(false);
									onToggleInclusion(items[0], true, statementMonth);
								}}
								onCancel={() => setShowMonthPicker(false)}
								disabled={togglingId === items[0].id}
							/>
						) : (
							<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
								<InclusionStatus
									included={items[0].included_on_statement}
									statementMonthLabel={items[0].statement_month_label}
								/>
								<button
									type="button"
									onClick={() => {
										if (items[0].included_on_statement) {
											onToggleInclusion(items[0], false);
											return;
										}
										setShowMonthPicker(true);
									}}
									disabled={togglingId === items[0].id}
									className={clsx(
										'text-sm',
										items[0].included_on_statement ? 'btn-secondary' : 'btn-primary',
									)}
								>
									{togglingId === items[0].id
										? 'Saving…'
										: items[0].included_on_statement
											? 'Remove from Owner Statement'
											: 'Add to Owner Statement'}
								</button>
							</div>
						)}
					</div>
				)}

				{pendingDelete && !editingKey && (
					<div
						ref={footerRef}
						className="shrink-0 border-t border-border px-5 py-3 flex flex-col gap-3 bg-white"
					>
						<p className="text-sm text-amber-800">
							{pendingDelete.source === 'bank'
								? 'Delete this transaction? Synced bank transactions may reappear after the next bank sync.'
								: 'Delete this transaction? This cannot be undone.'}
						</p>
						<div className="flex items-center justify-end gap-2">
							<button
								type="button"
								onClick={() => setPendingDelete(null)}
								disabled={deleting}
								className="btn-secondary text-sm"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={confirmDelete}
								disabled={deleting}
								className={clsx('btn-danger text-sm', deleting && 'opacity-60')}
							>
								{deleting ? 'Deleting…' : 'Delete'}
							</button>
						</div>
					</div>
				)}

				{editingKey && draft && (
					<div
						ref={footerRef}
						className="shrink-0 border-t border-border px-5 py-3 flex items-center justify-end gap-2 bg-white"
					>
						<button
							type="button"
							onClick={cancelEdit}
							disabled={saving}
							className="btn-secondary text-sm"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={saveEdit}
							disabled={saving}
							className="btn-primary text-sm"
						>
							{saving ? 'Saving…' : 'Save changes'}
						</button>
					</div>
				)}

				{items?.length > 0 && !editingKey && !pendingDelete && variant !== 'owner-statement' && (
					<div className="shrink-0 border-t border-border px-5 py-3 flex items-center justify-between bg-gray-50">
						<p className="text-sm text-muted">
							{items.length} {variant === 'reservations' ? 'reservation' : 'transaction'}{items.length === 1 ? '' : 's'}
						</p>
						<p className="text-sm font-bold text-dark">
							Total: <AmountCell amount={total} className="inline" />
						</p>
					</div>
				)}
			</div>
		</>
	);
}
