import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link2, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { fmt$ } from './format';
import { fetchJson } from '../../lib/apiClient';
import { formatDateOrDash, formatDateTime } from '../../lib/dates';
import { PageLoader } from '../LoadingSpinner';
import { useColumnVisibility } from './useColumnVisibility';
import { ToggleableTableHead, HiddenColumnsBar } from './ToggleableTableHead';

const BANK_COLUMNS = [
	{ key: 'date', label: 'Date' },
	{ key: 'description', label: 'Description' },
	{ key: 'account', label: 'Account' },
	{ key: 'category', label: 'Category' },
	{ key: 'amount', label: 'Amount' },
];

function loadPlaidScript() {
	if (typeof window === 'undefined') return Promise.resolve(false);
	if (window.Plaid) return Promise.resolve(true);

	return new Promise((resolve, reject) => {
		const existing = document.querySelector('script[data-plaid-link]');
		if (existing) {
			existing.addEventListener('load', () => resolve(true));
			existing.addEventListener('error', reject);
			return;
		}

		const script = document.createElement('script');
		script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
		script.async = true;
		script.dataset.plaidLink = 'true';
		script.onload = () => resolve(true);
		script.onerror = reject;
		document.body.appendChild(script);
	});
}

export default function BankFeedTransactions({ dateFrom, dateTo }) {
	const [status, setStatus] = useState(null);
	const [transactions, setTransactions] = useState([]);
	const [loading, setLoading] = useState(true);
	const [syncing, setSyncing] = useState(false);
	const [connecting, setConnecting] = useState(false);
	const [error, setError] = useState('');

	const loadTransactions = useCallback(async () => {
		const params = new URLSearchParams();
		if (dateFrom) params.set('date_from', dateFrom);
		if (dateTo) params.set('date_to', dateTo);
		const json = await fetchJson(`/api/bank/transactions?${params}`);
		setTransactions(json?.data || []);
	}, [dateFrom, dateTo]);

	const syncBank = useCallback(async () => {
		setSyncing(true);
		setError('');
		try {
			await fetchJson('/api/bank/sync', { method: 'POST', body: {} });
			await loadTransactions();
			const nextStatus = await fetchJson('/api/bank/status');
			setStatus(nextStatus);
		} catch (err) {
			setError(err.message);
		} finally {
			setSyncing(false);
		}
	}, [loadTransactions]);

	const loadBankFeed = useCallback(async ({ autoSync = false } = {}) => {
		setLoading(true);
		setError('');
		try {
			const nextStatus = await fetchJson('/api/bank/status');
			setStatus(nextStatus);

			if (autoSync && nextStatus?.linked) {
				try {
					await fetchJson('/api/bank/sync', { method: 'POST', body: {} });
					const refreshed = await fetchJson('/api/bank/status');
					setStatus(refreshed);
				} catch (syncErr) {
					setError(syncErr.message);
				}
			}

			await loadTransactions();
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	}, [loadTransactions]);

	useEffect(() => {
		loadBankFeed({ autoSync: true });
	}, [loadBankFeed]);

	async function connectBank() {
		setConnecting(true);
		setError('');
		try {
			await loadPlaidScript();
			const { linkToken } = await fetchJson('/api/bank/plaid/link-token', {
				method: 'POST',
				body: {},
			});

			const handler = window.Plaid.create({
				token: linkToken,
				onSuccess: async (publicToken) => {
					try {
						await fetchJson('/api/bank/plaid/exchange', {
							method: 'POST',
							body: { publicToken },
						});
						await syncBank();
					} catch (err) {
						setError(err.message);
					} finally {
						setConnecting(false);
					}
				},
				onExit: () => setConnecting(false),
			});
			handler.open();
		} catch (err) {
			setError(err.message);
			setConnecting(false);
		}
	}

	const total = transactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

	const columnLabels = useMemo(
		() => Object.fromEntries(BANK_COLUMNS.map((c) => [c.key, c.label])),
		[],
	);

	const { isVisible, hide, show, hiddenColumns } = useColumnVisibility(
		BANK_COLUMNS.map((c) => c.key),
	);

	const visibleBeforeAmount = BANK_COLUMNS.filter(
		(c) => c.key !== 'amount' && isVisible(c.key),
	).length;

	return (
		<div>
			<div className="flex flex-wrap items-center justify-between gap-3 mb-4">
				<div className="text-sm text-muted">
					{status?.linked ? (
						<>
							<span className="inline-flex items-center rounded-full bg-green-50 text-green-700 px-2 py-0.5 text-xs font-medium mr-2">
								Connected
							</span>
							{status.institutionName}
							{status.lastSync && (
								<span className="ml-2 text-xs">
									· Last sync {formatDateTime(status.lastSync)}
								</span>
							)}
						</>
					) : status?.plaidConfigured ? (
						<span className="text-muted">Connect your bank to import transactions automatically.</span>
					) : (
						<span className="text-muted">
							Add <code className="text-xs bg-gray-100 px-1 rounded">PLAID_CLIENT_ID</code> and{' '}
							<code className="text-xs bg-gray-100 px-1 rounded">PLAID_SECRET</code> to enable Plaid.
						</span>
					)}
				</div>
				<div className="flex gap-2">
					{status?.plaidConfigured && !status?.linked && (
						<button
							type="button"
							onClick={connectBank}
							disabled={connecting}
							className="btn-primary text-xs gap-1.5"
						>
							<Link2 size={14} />
							{connecting ? 'Connecting…' : 'Connect Bank'}
						</button>
					)}
					{status?.linked && (
						<button
							type="button"
							onClick={syncBank}
							disabled={syncing}
							className="btn-secondary text-xs gap-1.5"
						>
							<RefreshCw size={14} className={clsx(syncing && 'animate-spin')} />
							{syncing ? 'Syncing…' : 'Sync Now'}
						</button>
					)}
				</div>
			</div>

			{error && (
				<div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">
					{error}
				</div>
			)}

			{loading ? (
				<PageLoader message="Loading bank transactions…" />
			) : transactions.length === 0 ? (
				<p className="text-muted text-sm text-center py-10">
					{status?.linked
						? 'No bank transactions for the selected period. Try syncing or widening the date range.'
						: 'No bank transactions yet. Connect your bank via Plaid to import them automatically.'}
				</p>
			) : (
				<>
					<HiddenColumnsBar columns={hiddenColumns} labels={columnLabels} onShow={show} />
					<div className="transactions-table-scroll">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-border">
									{BANK_COLUMNS.map(({ key, label }) =>
										isVisible(key) ? (
											<ToggleableTableHead
												key={key}
												label={label}
												align={key === 'amount' ? 'right' : 'left'}
												onHide={() => hide(key)}
											/>
										) : null,
									)}
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{transactions.map((tx) => (
									<tr key={tx.id} className="hover:bg-gray-50">
										{isVisible('date') && (
											<td className="table-cell whitespace-nowrap">{formatDateOrDash(tx.date)}</td>
										)}
										{isVisible('description') && (
											<td className="table-cell">
												<p className="font-medium text-dark">{tx.description}</p>
												{tx.pending && <p className="text-xs text-amber-600">Pending</p>}
											</td>
										)}
										{isVisible('account') && (
											<td className="table-cell text-muted">{tx.account || '—'}</td>
										)}
										{isVisible('category') && (
											<td className="table-cell text-muted capitalize">{tx.category?.replace(/_/g, ' ') || '—'}</td>
										)}
										{isVisible('amount') && (
											<td className={clsx(
												'table-cell text-right font-medium',
												Number(tx.amount) >= 0 ? 'text-green-600' : 'text-red-600',
											)}>
												{fmt$(Number(tx.amount))}
											</td>
										)}
									</tr>
								))}
								<tr className="border-t-2 border-brand-200 bg-gray-50 font-semibold">
									<td className="table-cell" colSpan={Math.max(visibleBeforeAmount, 1)}>Net total</td>
									{isVisible('amount') && (
										<td className={clsx(
											'table-cell text-right',
											total >= 0 ? 'text-green-600' : 'text-red-600',
										)}>
											{fmt$(total)}
										</td>
									)}
								</tr>
							</tbody>
						</table>
					</div>
				</>
			)}
		</div>
	);
}
