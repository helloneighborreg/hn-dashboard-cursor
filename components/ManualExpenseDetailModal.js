import { useEffect, useState } from 'react';
import { X, Pencil, Trash2, CalendarDays, Home, Tag, FileText, DollarSign, FileCheck2 } from 'lucide-react';
import clsx from 'clsx';
import DateInput from './DateInput';
import CategorySelect from './bookkeeping/CategorySelect';
import OwnerStatementInclusionBadge from './financials/OwnerStatementInclusionBadge';
import { fmt$ } from './financials/format';
import { formatDateOrDash } from '../lib/dates';
import { fetchJson } from '../lib/apiClient';
import { getPropertyDisplayName } from '../lib/codes';
import { categoryLabel } from '../lib/bookkeepingCategories';
import { useEscapeKey } from '../lib/useEscapeKey';
import { useFocusTrap } from '../lib/useFocusTrap';

function DetailRow({ icon: Icon, label, value }) {
	return (
		<div className="flex items-start gap-3">
			<div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
				<Icon size={14} className="text-muted" />
			</div>
			<div className="min-w-0">
				<p className="text-xs text-muted leading-none mb-0.5">{label}</p>
				<div className="text-sm leading-snug break-words text-dark">{value ?? '—'}</div>
			</div>
		</div>
	);
}

function buildForm(expense) {
	return {
		date: expense?.date || '',
		property_id: expense?.property_id || '',
		category: expense?.category || '',
		vendor: expense?.vendor || '',
		amount: expense?.amount != null ? String(expense.amount) : '',
		notes: expense?.notes || '',
	};
}

export default function ManualExpenseDetailModal({ expense, properties = [], onClose, onSaved, onDeleted }) {
	const [editing, setEditing] = useState(false);
	const [form, setForm] = useState(() => buildForm(expense));
	const [saving, setSaving] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [err, setErr] = useState('');

	useEscapeKey(onClose);
	const dialogRef = useFocusTrap();

	useEffect(() => {
		setForm(buildForm(expense));
		setEditing(false);
		setConfirmDelete(false);
		setErr('');
	}, [expense]);

	if (!expense) return null;

	const propertyName = expense.property_name
		|| (expense.property_id && getPropertyDisplayName(properties.find((p) => p.id === expense.property_id)))
		|| expense.property_id
		|| '—';

	function cancelEdit() {
		setForm(buildForm(expense));
		setEditing(false);
		setErr('');
	}

	async function save(e) {
		e.preventDefault();
		setErr('');
		if (!form.property_id || !form.category || !form.amount) {
			setErr('Property, category, and amount are required');
			return;
		}
		setSaving(true);
		try {
			const prop = properties.find((p) => p.id === form.property_id);
			const json = await fetchJson(`/api/expenses/${expense.id}`, {
				method: 'PATCH',
				body: {
					...form,
					amount: parseFloat(form.amount),
					property_name: getPropertyDisplayName(prop) || '',
				},
			});
			const updated = json?.data;
			setEditing(false);
			onSaved?.(updated);
		} catch (error) {
			setErr(error.message);
		} finally {
			setSaving(false);
		}
	}

	async function remove() {
		setErr('');
		setDeleting(true);
		try {
			await fetchJson(`/api/expenses/${expense.id}`, { method: 'DELETE' });
			onDeleted?.(expense.id);
			onClose?.();
		} catch (error) {
			setErr(error.message);
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
				aria-label="Manual expense details"
				className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden focus:outline-none"
			>
				<div className="flex items-center justify-between px-5 py-4 border-b border-border">
					<div className="min-w-0">
						<p className="font-semibold text-dark text-sm leading-snug truncate">
							{editing ? 'Edit transaction' : 'Manual expense'}
						</p>
						<p className="text-xs text-muted truncate">
							{formatDateOrDash(expense.date)}
							{expense.vendor ? ` · ${expense.vendor}` : ''}
						</p>
					</div>
					<div className="flex items-center gap-1 flex-shrink-0">
						{!editing && (
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
					{!editing && (
						<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700">
							{fmt$(Number(expense.amount))}
						</span>
					)}

					{editing ? (
						<form id="manual-expense-edit-form" onSubmit={save} className="space-y-4">
							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className="label">Date *</label>
									<DateInput
										value={form.date}
										onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
										required
									/>
								</div>
								<div>
									<label className="label">Amount (USD) *</label>
									<input
										type="number"
										step="0.01"
										min="0"
										className="input"
										value={form.amount}
										onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
										required
									/>
								</div>
							</div>
							<div>
								<label className="label">Property *</label>
								<select
									className="select"
									value={form.property_id}
									onChange={(e) => setForm((f) => ({ ...f, property_id: e.target.value }))}
									required
								>
									<option value="">Select a property…</option>
									{properties.map((p) => (
										<option key={p.id} value={p.id}>{getPropertyDisplayName(p) || p.name}</option>
									))}
								</select>
							</div>
							<div>
								<label className="label">Category *</label>
								<CategorySelect
									value={form.category}
									onChange={(category) => setForm((f) => ({ ...f, category }))}
									placeholder="Select category…"
									className="select w-full max-w-none"
								/>
							</div>
							<div>
								<label className="label">Vendor</label>
								<input
									type="text"
									className="input"
									placeholder="Vendor or payee"
									value={form.vendor}
									onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
								/>
							</div>
							<div>
								<label className="label">Notes</label>
								<textarea
									className="input resize-none"
									rows={2}
									placeholder="Optional notes…"
									value={form.notes}
									onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
								/>
							</div>
							{err && <p className="text-red-600 text-sm">{err}</p>}
						</form>
					) : (
						<div className="space-y-3">
							<DetailRow icon={CalendarDays} label="Date" value={formatDateOrDash(expense.date)} />
							<DetailRow icon={DollarSign} label="Amount" value={fmt$(Number(expense.amount))} />
							<DetailRow icon={Home} label="Property" value={propertyName} />
							<DetailRow
								icon={Tag}
								label="Category"
								value={expense.category ? categoryLabel(expense.category) : '—'}
							/>
							<DetailRow icon={FileText} label="Vendor" value={expense.vendor || '—'} />
							<DetailRow icon={FileText} label="Notes" value={expense.notes?.trim() ? expense.notes.trim() : '—'} />
							<DetailRow
								icon={FileCheck2}
								label="Owner statement"
								value={<OwnerStatementInclusionBadge inclusion={expense.owner_statement_inclusion} />}
							/>
						</div>
					)}
				</div>

				{(editing || onDeleted) && (
					<div className="shrink-0 border-t border-border px-5 py-4 space-y-3">
						{editing && (
							<div className="flex gap-3">
								<button type="button" onClick={cancelEdit} className="btn-secondary flex-1 justify-center">
									Cancel
								</button>
								<button
									type="submit"
									form="manual-expense-edit-form"
									disabled={saving}
									className={clsx('btn-primary flex-1 justify-center', saving && 'opacity-60')}
								>
									{saving ? 'Saving…' : 'Save changes'}
								</button>
							</div>
						)}
						{!editing && onDeleted && (
							confirmDelete ? (
								<div className="space-y-2">
									<p className="text-sm text-amber-800">Delete this transaction? This cannot be undone.</p>
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
						{err && !editing && <p className="text-red-600 text-sm">{err}</p>}
					</div>
				)}
			</div>
		</>
	);
}
