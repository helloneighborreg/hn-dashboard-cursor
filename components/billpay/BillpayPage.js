import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Circle, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { PageLoader, ErrorState, EmptyState } from '../LoadingSpinner';
import PageSearchInput from '../PageSearchInput';
import { fetchJson } from '../../lib/apiClient';
import { formatDateOrDash } from '../../lib/dates';
import { fmt$ } from '../financials/format';
import { sortByKey } from '../../lib/tableSort';
import { useTableSort } from '../financials/useTableSort';
import { SortableTableHead } from '../financials/SortableTableHead';

const TABS = [
	{ value: 'pending', label: 'Upcoming' },
	{ value: 'completed', label: 'Paid out' },
];

const NUMERIC_KEYS = new Set(['amount']);

function getInvoiceSortValue(invoice, key) {
	switch (key) {
		case 'payee': return invoice.payee || '';
		case 'property': return invoice.property_name || invoice.property_id || '';
		case 'reservation': return invoice.reservation_id || '';
		case 'checkout': return invoice.checkout_date || '';
		case 'description': return invoice.description || '';
		case 'amount': return invoice.amount || 0;
		case 'marked': return invoice.paid_at || '';
		default: return '';
	}
}

export default function BillpayPage() {
	const [tab, setTab] = useState('pending');
	const [invoices, setInvoices] = useState([]);
	const [summary, setSummary] = useState({ count: 0, total: 0 });
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState('');
	const [search, setSearch] = useState('');
	const [savingId, setSavingId] = useState(null);
	const { sortKey, sortDir, toggleSort } = useTableSort('checkout', 'desc');

	const load = useCallback(async (activeTab = tab, { silent = false } = {}) => {
		if (silent) setRefreshing(true);
		else setLoading(true);
		setError('');
		try {
			const json = await fetchJson(`/api/billpay?status=${activeTab}`);
			setInvoices(json?.data || []);
			setSummary(json?.summary || { count: 0, total: 0 });
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	}, [tab]);

	useEffect(() => {
		load(tab);
	}, [tab, load]);

	const filteredInvoices = useMemo(() => {
		if (!search.trim()) return invoices;
		const q = search.toLowerCase();
		return invoices.filter((invoice) =>
			invoice.payee?.toLowerCase().includes(q)
			|| invoice.property_name?.toLowerCase().includes(q)
			|| invoice.reservation_id?.toLowerCase().includes(q)
			|| invoice.guest_name?.toLowerCase().includes(q)
			|| invoice.description?.toLowerCase().includes(q),
		);
	}, [invoices, search]);

	const displayInvoices = useMemo(
		() => sortByKey(filteredInvoices, sortKey, sortDir, getInvoiceSortValue, { numericKeys: NUMERIC_KEYS }),
		[filteredInvoices, sortKey, sortDir],
	);

	async function toggleInvoiceStatus(invoice) {
		setSavingId(invoice.id);
		try {
			const nextStatus = invoice.status === 'completed' ? 'pending' : 'completed';
			await fetchJson(`/api/billpay/${invoice.id}`, {
				method: 'PATCH',
				body: nextStatus === 'pending' ? { status: 'pending' } : {},
			});
			await load(tab, { silent: true });
		} catch (err) {
			alert(err.message);
		} finally {
			setSavingId(null);
		}
	}

	if (loading) return <PageLoader />;

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl font-bold text-dark">Billpay</h1>
					<p className="text-sm text-muted mt-1">
						Cleaning invoices queued when tasks are marked paid in Tasks.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => load(tab, { silent: true })}
						disabled={refreshing}
						className="btn-secondary text-sm gap-1.5"
					>
						<RefreshCw size={14} className={clsx(refreshing && 'animate-spin')} />
						Refresh
					</button>
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-3">
				<div className="inline-flex rounded-lg border border-border bg-white p-1">
					{TABS.map((item) => (
						<button
							key={item.value}
							type="button"
							onClick={() => setTab(item.value)}
							className={clsx(
								'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
								tab === item.value ? 'bg-brand-500 text-white' : 'text-muted hover:text-dark',
							)}
						>
							{item.label}
						</button>
					))}
				</div>
				<PageSearchInput value={search} onChange={setSearch} placeholder="Search payee, property, reservation…" />
			</div>

			{error && <ErrorState message={error} onRetry={() => load(tab)} />}

			<div className="card p-5">
				<div className="flex items-center justify-between mb-4">
					<h2 className="font-semibold text-dark">
						{tab === 'pending' ? 'Scheduled for next bill run' : 'Paid out'}
						{displayInvoices.length ? ` (${displayInvoices.length})` : ''}
					</h2>
					<p className="text-sm font-semibold text-dark tabular-nums">
						Total: {fmt$(summary.total)}
					</p>
				</div>

				{displayInvoices.length > 0 ? (
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr className="border-b border-border">
									<SortableTableHead sortKey="payee" label="Payee" active={sortKey === 'payee'} direction={sortDir} onSort={toggleSort} />
									<SortableTableHead sortKey="property" label="Property" active={sortKey === 'property'} direction={sortDir} onSort={toggleSort} />
									<SortableTableHead sortKey="reservation" label="Reservation" active={sortKey === 'reservation'} direction={sortDir} onSort={toggleSort} />
									<SortableTableHead sortKey="checkout" label="Checkout" active={sortKey === 'checkout'} direction={sortDir} onSort={toggleSort} className="table-head-date" />
									<SortableTableHead sortKey="description" label="Task" active={sortKey === 'description'} direction={sortDir} onSort={toggleSort} />
									<SortableTableHead sortKey="marked" label="Marked paid" active={sortKey === 'marked'} direction={sortDir} onSort={toggleSort} className="table-head-date" />
									<SortableTableHead sortKey="amount" label="Amount" align="right" active={sortKey === 'amount'} direction={sortDir} onSort={toggleSort} />
									<SortableTableHead label={tab === 'pending' ? 'Paid out' : 'Status'} sortable={false} align="center" />
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{displayInvoices.map((invoice) => (
									<tr key={invoice.id} className="hover:bg-gray-50">
										<td className="table-cell font-medium">{invoice.payee || '—'}</td>
										<td className="table-cell">{invoice.property_name || '—'}</td>
										<td className="table-cell font-mono text-xs">{invoice.reservation_id || '—'}</td>
										<td className="table-cell-date">{formatDateOrDash(invoice.checkout_date)}</td>
										<td className="table-cell">
											<div className="min-w-0">
												<p className="truncate max-w-xs">{invoice.description || '—'}</p>
												{invoice.guest_name && (
													<p className="text-xs text-muted truncate max-w-xs">{invoice.guest_name}</p>
												)}
												{invoice.additional_amount > 0 && (
													<p className="text-xs text-muted truncate max-w-xs">
														+{fmt$(invoice.additional_amount)}
														{invoice.additional_description ? ` · ${invoice.additional_description}` : ''}
													</p>
												)}
											</div>
										</td>
										<td className="table-cell-date">
											<div>{formatDateOrDash(invoice.paid_at)}</div>
											{invoice.paid_by && (
												<div className="text-xs text-muted">{invoice.paid_by}</div>
											)}
										</td>
										<td className="table-cell text-right font-medium">{fmt$(invoice.amount)}</td>
										<td className="table-cell text-center">
											<button
												type="button"
												onClick={() => toggleInvoiceStatus(invoice)}
												disabled={savingId === invoice.id}
												className={clsx(
													'inline-flex items-center justify-center rounded p-1 disabled:opacity-50',
													tab === 'completed'
														? 'text-green-600 hover:bg-green-50'
														: 'text-muted hover:text-green-600 hover:bg-green-50',
												)}
												title={tab === 'completed' ? 'Paid out — click to move back to upcoming' : 'Mark as paid out'}
												aria-label={tab === 'completed' ? 'Paid out — click to move back to upcoming' : 'Mark as paid out'}
											>
												{tab === 'completed'
													? <Check size={18} strokeWidth={2.5} aria-hidden />
													: <Circle size={18} aria-hidden />}
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : (
					<EmptyState
						title={tab === 'pending' ? 'No upcoming billpay items' : 'No paid-out invoices'}
						message={
							tab === 'pending'
								? 'Mark completed tasks as paid in Tasks to queue invoices here.'
								: 'Invoices you mark as paid out will appear here.'
						}
					/>
				)}
			</div>
		</div>
	);
}
