import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import ManualExpenseDetailModal from './ManualExpenseDetailModal';
import TransactionDetailModal from './bookkeeping/TransactionDetailModal';
import { PageLoader } from './LoadingSpinner';
import { fetchJson } from '../lib/apiClient';
import { getPropertyDisplayName } from '../lib/codes';
import { canEditTransaction } from '../lib/bookkeepingClient';

export default function TransactionEditOverlay({ item, properties = [], onClose, onSaved }) {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [bankTx, setBankTx] = useState(null);
	const [expense, setExpense] = useState(null);

	const propertyNameById = useMemo(
		() => Object.fromEntries(properties.map((p) => [p.id, getPropertyDisplayName(p) || p.name])),
		[properties],
	);

	const propertyOptions = useMemo(
		() => properties.map((p) => ({ value: p.id, label: getPropertyDisplayName(p) || p.name })),
		[properties],
	);

	useEffect(() => {
		if (!item?.id || !canEditTransaction(item)) {
			setLoading(false);
			return undefined;
		}

		let cancelled = false;

		async function load() {
			setLoading(true);
			setError('');
			setBankTx(null);
			setExpense(null);
			try {
				if (item.source === 'bank') {
					const json = await fetchJson(`/api/bank/transactions/${item.id}`);
					if (!cancelled) setBankTx(json?.data || null);
				} else if (item.source === 'manual') {
					const json = await fetchJson(`/api/expenses/${item.id}`);
					if (!cancelled) setExpense(json?.data || null);
				}
			} catch (err) {
				if (!cancelled) setError(err.message);
			} finally {
				if (!cancelled) setLoading(false);
			}
		}

		load();
		return () => { cancelled = true; };
	}, [item]);

	if (!item || !canEditTransaction(item)) return null;

	if (loading) {
		return (
			<>
				<div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
				<div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl flex items-center justify-center">
					<PageLoader message="Loading transaction…" />
				</div>
			</>
		);
	}

	if (error) {
		return (
			<>
				<div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
				<div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col">
					<div className="flex items-center justify-between px-5 py-4 border-b border-border">
						<p className="font-semibold text-dark text-sm">Could not load transaction</p>
						<button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-dark p-1">
							<X size={18} />
						</button>
					</div>
					<p className="p-5 text-sm text-red-600">{error}</p>
				</div>
			</>
		);
	}

	if (bankTx) {
		return (
			<TransactionDetailModal
				tx={bankTx}
				propertyNameById={propertyNameById}
				propertyOptions={propertyOptions}
				onClose={onClose}
				onSave={async (patch) => {
					const json = await fetchJson(`/api/bank/transactions/${bankTx.id}`, {
						method: 'PATCH',
						body: patch,
					});
					const updated = json?.data;
					if (updated) setBankTx(updated);
					await onSaved?.(updated);
				}}
				onToggleExcluded={async (excluded) => {
					const json = await fetchJson(`/api/bank/transactions/${bankTx.id}`, {
						method: 'PATCH',
						body: { hidden: excluded },
					});
					const updated = json?.data;
					if (updated) setBankTx(updated);
					await onSaved?.(updated);
				}}
				onDeleted={async (id) => {
					await fetchJson(`/api/bank/transactions/${id}`, { method: 'DELETE' });
					await onSaved?.(null);
					onClose?.();
				}}
			/>
		);
	}

	if (expense) {
		return (
			<ManualExpenseDetailModal
				expense={expense}
				properties={properties}
				onClose={onClose}
				onSaved={async (updated) => {
					if (updated) setExpense(updated);
					await onSaved?.(updated);
				}}
				onDeleted={async () => {
					await onSaved?.(null);
					onClose?.();
				}}
			/>
		);
	}

	return null;
}
