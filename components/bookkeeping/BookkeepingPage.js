import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, subMonths, parseISO } from 'date-fns';
import {
	Check, Download, EyeOff, Link2, RefreshCw, SlidersHorizontal, X,
} from 'lucide-react';
import clsx from 'clsx';
import PageSearchInput from '../PageSearchInput';
import { PageLoader } from '../LoadingSpinner';
import { fmt$ } from '../financials/format';
import { SortableTableHead } from '../financials/SortableTableHead';
import { useTableSort } from '../financials/useTableSort';
import { sortByKey } from '../../lib/tableSort';
import { fetchJson } from '../../lib/apiClient';
import { getPropertyDisplayName } from '../../lib/codes';
import { formatDateOrDash, ISO_DATE_FMT, todayIso } from '../../lib/dates';
import { loadPlaidScript } from '../../lib/loadPlaidScript';
import { BOOKKEEPING_CATEGORY_GROUPS } from '../../lib/bookkeepingCategories';
import CategorySelect, { CategoryTypeBadge, ResettingCategorySelect } from './CategorySelect';
import {
	exportTransactionsCsv,
	filterTransactionsClient,
	uniqueAccounts,
} from '../../lib/bookkeepingClient';
import { buildMatchPatch } from '../../lib/reservationMatching';
import { buildMatchedIncomeById, getReservationSplits, suggestBundledPayoutSplits } from '../../lib/reservationSplits';
import ReservationMatchSelect from './ReservationMatchSelect';
import TransactionDetailModal from './TransactionDetailModal';
import {
	CategorizationProgress,
	DateRangeFilterContent,
	FilterPill,
	formatDateFilterLabel,
	InlineSelect,
	ToggleSwitch,
} from './BookkeepingControls';

/** Wider window so payouts after checkout are available for matching. */
function hospitableDateRange(filters) {
	const from = filters.date_from
		? format(subMonths(parseISO(filters.date_from), 4), ISO_DATE_FMT)
		: format(subMonths(new Date(), 6), ISO_DATE_FMT);
	return {
		date_from: from,
		date_to: filters.date_to || todayIso(),
	};
}

function MobileTransactionCard({
	tx,
	selected,
	propertyName,
	onToggleSelect,
	onOpen,
}) {
	const amount = Number(tx.amount);

	return (
		<div className={clsx(
			'rounded-xl border border-border bg-white p-3 shadow-card',
			tx.hidden && 'opacity-60',
		)}>
			<div className="flex items-start gap-3">
				<input
					type="checkbox"
					checked={selected}
					onChange={onToggleSelect}
					aria-label={`Select ${tx.description}`}
					className="mt-1 h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500"
				/>
				<button
					type="button"
					onClick={onOpen}
					className="min-w-0 flex-1 text-left focus:outline-none focus:ring-2 focus:ring-brand-500 rounded-lg"
				>
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0">
							<p className="truncate text-sm font-semibold text-dark">{tx.description || 'Transaction'}</p>
							<p className="mt-0.5 text-xs text-muted">
								{formatDateOrDash(tx.date)}{tx.account ? ` · ${tx.account}` : ''}
							</p>
						</div>
						<p className={clsx(
							'shrink-0 text-sm font-semibold tabular-nums',
							amount >= 0 ? 'text-green-600' : 'text-red-600',
						)}>
							{fmt$(amount)}
						</p>
					</div>

					<div className="mt-3 flex flex-wrap items-center gap-1.5">
						{tx.category ? (
							<CategoryTypeBadge category={tx.category} />
						) : (
							<span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
								Uncategorized
							</span>
						)}
						{propertyName && (
							<span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-muted">
								{propertyName}
							</span>
						)}
						{tx.pending && (
							<span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
								Pending
							</span>
						)}
						{!tx.reviewed && (
							<span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-muted">
								Needs review
							</span>
						)}
					</div>
				</button>
			</div>
		</div>
	);
}

export default function BookkeepingPage() {
	const [properties, setProperties] = useState([]);
	const [reservations, setReservations] = useState([]);
	const [transactions, setTransactions] = useState([]);
	const [summary, setSummary] = useState(null);
	const [bankStatus, setBankStatus] = useState(null);
	const [loading, setLoading] = useState(true);
	const [syncing, setSyncing] = useState(false);
	const [connecting, setConnecting] = useState(false);
	const [error, setError] = useState('');
	const [tab, setTab] = useState('all');
	const [search, setSearch] = useState('');
	const [selected, setSelected] = useState(new Set());
	const [savingId, setSavingId] = useState(null);
	const [filtersReady, setFiltersReady] = useState(false);
	const [detailTx, setDetailTx] = useState(null);
	const [splitDraft, setSplitDraft] = useState(null);

	const [filters, setFilters] = useState({
		date_from: format(subMonths(new Date(), 3), ISO_DATE_FMT),
		date_to: todayIso(),
		account_id: '',
		category: '',
		property_id: '',
		uncategorizedOnly: false,
		showHidden: false,
	});

	const propertyNameById = useMemo(
		() => Object.fromEntries(properties.map((p) => [p.id, getPropertyDisplayName(p) || p.name])),
		[properties],
	);

	const accounts = useMemo(() => uniqueAccounts(transactions), [transactions]);

	const reservationById = useMemo(
		() => Object.fromEntries(reservations.map((r) => [r.id, r])),
		[reservations],
	);

	const { sortKey, sortDir, toggleSort } = useTableSort('date', 'desc');

	const reservationMatchedIncomeById = useMemo(
		() => buildMatchedIncomeById(transactions),
		[transactions],
	);

	const reservationRemainingById = useMemo(() => {
		const remaining = new Map();
		for (const r of reservations) {
			const payout = Number(r.revenue ?? r.owner_payout) || 0;
			const matched = reservationMatchedIncomeById.get(r.id) || 0;
			remaining.set(r.id, Math.max(0, payout - matched));
		}
		return remaining;
	}, [reservations, reservationMatchedIncomeById]);

	const loadReservations = useCallback(async () => {
		const range = hospitableDateRange(filters);
		const params = new URLSearchParams({
			date_from: range.date_from,
			date_to: range.date_to,
		});
		if (filters.property_id) params.set('property', filters.property_id);
		const json = await fetchJson(`/api/financials?${params}`);
		setReservations(json?.data?.reservations || []);
	}, [filters]);

	const loadTransactions = useCallback(async () => {
		const params = new URLSearchParams();
		if (filters.date_from) params.set('date_from', filters.date_from);
		if (filters.date_to) params.set('date_to', filters.date_to);
		if (filters.account_id) params.set('account_id', filters.account_id);
		if (filters.category) params.set('category', filters.category);
		if (filters.property_id) params.set('property_id', filters.property_id);
		if (filters.uncategorizedOnly) params.set('uncategorized', 'true');
		if (!filters.showHidden) params.set('hidden', 'false');

		const json = await fetchJson(`/api/bank/transactions?${params}`);
		setTransactions(json?.data || []);
		setSummary(json?.summary || null);
	}, [filters]);

	const loadAll = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const status = await fetchJson('/api/bank/status');
			setBankStatus(status);
			await Promise.all([loadTransactions(), loadReservations()]);
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	}, [loadTransactions, loadReservations]);

	useEffect(() => {
		fetchJson('/api/properties')
			.then((json) => setProperties(json?.data || []))
			.catch(() => setProperties([]));
		loadAll().then(() => setFiltersReady(true));
	}, [loadAll]);

	// loadAll() already fetched the initial transactions/reservations, so skip the first
	// run triggered by filtersReady flipping true; only reload on subsequent filter changes.
	const skipNextFilterLoad = useRef(true);
	useEffect(() => {
		if (!filtersReady) return;
		if (skipNextFilterLoad.current) {
			skipNextFilterLoad.current = false;
			return;
		}
		loadTransactions().catch((err) => setError(err.message));
		loadReservations().catch((err) => setError(err.message));
	}, [filters, filtersReady, loadTransactions, loadReservations]);

	async function syncBank() {
		setSyncing(true);
		setError('');
		try {
			await fetchJson('/api/bank/sync', { method: 'POST', body: {} });
			await loadAll();
		} catch (err) {
			setError(err.message);
		} finally {
			setSyncing(false);
		}
	}

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

	async function saveReservationSplits(txId, splits) {
		await patchTx(txId, { reservation_splits: splits });
		setSplitDraft(null);
	}

	async function matchReservation(txId, reservationId) {
		const tx = transactions.find((row) => row.id === txId);
		if (!tx) return;

		if (!reservationId) {
			setSplitDraft(null);
			await patchTx(txId, buildMatchPatch(tx, null, reservations, {
				matchedIncomeById: reservationMatchedIncomeById,
			}));
			return;
		}

		const reservation = reservations.find((r) => r.id === reservationId);
		const suggested = suggestBundledPayoutSplits(tx, reservation);
		if (suggested) {
			setSplitDraft(suggested.map((row) => ({
				reservation_id: row.reservation_id,
				amount: row.amount,
				type: row.type,
			})));
			setDetailTx(tx);
			return;
		}

		setSplitDraft(null);
		await patchTx(txId, buildMatchPatch(tx, reservationId, reservations, {
			matchedIncomeById: reservationMatchedIncomeById,
		}));
	}

	async function patchTx(id, patch) {
		setSavingId(id);
		try {
			const json = await fetchJson(`/api/bank/transactions/${id}`, {
				method: 'PATCH',
				body: patch,
			});
			const updated = json?.data;
			if (updated) {
				setTransactions((rows) => rows.map((r) => (r.id === id ? { ...r, ...updated } : r)));
			}
			await loadTransactions();
			return updated;
		} catch (err) {
			setError(err.message);
			throw err;
		} finally {
			setSavingId(null);
		}
	}

	async function deleteTx(id) {
		setSavingId(id);
		try {
			await fetchJson(`/api/bank/transactions/${id}`, { method: 'DELETE' });
			setDetailTx(null);
			setSplitDraft(null);
			setTransactions((rows) => rows.filter((r) => r.id !== id));
			await loadTransactions();
		} catch (err) {
			setError(err.message);
			throw err;
		} finally {
			setSavingId(null);
		}
	}

	async function bulkPatch(patch) {
		const ids = [...selected];
		if (!ids.length) return;
		setError('');
		try {
			await fetchJson('/api/bank/transactions/bulk', {
				method: 'PATCH',
				body: { ids, ...patch },
			});
			setSelected(new Set());
			await loadTransactions();
		} catch (err) {
			setError(err.message);
		}
	}

	const displayed = useMemo(
		() => filterTransactionsClient(transactions, { search, tab }),
		[transactions, search, tab],
	);

	const sortedDisplayed = useMemo(() => sortByKey(
		displayed,
		sortKey,
		sortDir,
		(tx, key) => {
			switch (key) {
				case 'date': return tx.date || '';
				case 'account': return tx.account || '';
				case 'description': return tx.description || '';
				case 'amount': return Number(tx.amount) || 0;
				case 'category': return tx.category || '';
				case 'property': return propertyNameById[tx.property_id] || '';
				case 'reservation': return reservationById[tx.reservation_id]?.code || '';
				case 'note': return tx.notes || '';
				case 'reviewed': return tx.reviewed ? 1 : 0;
				case 'excluded': return tx.hidden ? 1 : 0;
				default: return '';
			}
		},
		{ numericKeys: new Set(['amount', 'reviewed', 'excluded']) },
	), [displayed, sortKey, sortDir, propertyNameById, reservationById]);

	const needsReviewCount = summary?.needs_review_count ?? 0;

	function toggleSelect(id) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	function toggleSelectAll() {
		if (selected.size === displayed.length) {
			setSelected(new Set());
		} else {
			setSelected(new Set(displayed.map((tx) => tx.id)));
		}
	}

	function clearFilters() {
		setFilters({
			date_from: format(subMonths(new Date(), 3), ISO_DATE_FMT),
			date_to: todayIso(),
			account_id: '',
			category: '',
			property_id: '',
			uncategorizedOnly: false,
			showHidden: false,
		});
		setSearch('');
	}

	function exportCsv() {
		const csv = exportTransactionsCsv(displayed, propertyNameById, reservationById);
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `transactions-${todayIso()}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	const propertyOptions = properties.map((p) => ({ value: p.id, label: getPropertyDisplayName(p) || p.name }));

	const hasActiveFilters = filters.account_id || filters.category || filters.property_id
		|| filters.uncategorizedOnly || filters.showHidden || search;

	return (
		<div className="space-y-4">
			{detailTx && (
				<TransactionDetailModal
					tx={detailTx}
					propertyNameById={propertyNameById}
					propertyOptions={propertyOptions}
					reservationById={reservationById}
					reservations={reservations}
					reservationMatchedIncomeById={reservationMatchedIncomeById}
					saving={savingId === detailTx.id}
					initialSplitRows={splitDraft}
					onClose={() => {
						setDetailTx(null);
						setSplitDraft(null);
					}}
					onSave={async (patch) => {
						const updated = await patchTx(detailTx.id, patch);
						if (updated) setDetailTx(updated);
					}}
					onSaveSplits={(splits) => saveReservationSplits(detailTx.id, splits)}
					onToggleExcluded={async (excluded) => {
						await patchTx(detailTx.id, { hidden: excluded });
						setDetailTx((prev) => (prev ? { ...prev, hidden: excluded } : null));
					}}
					onDeleted={deleteTx}
				/>
			)}
			<CategorizationProgress summary={summary} />

			<div className="flex flex-wrap gap-2 border-b border-border pb-1">
				<button
					type="button"
					onClick={() => setTab('all')}
					className={clsx(
						'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
						tab === 'all'
							? 'border-brand-500 text-brand-600'
							: 'border-transparent text-muted hover:text-dark',
					)}
				>
					All transactions
				</button>
				<button
					type="button"
					onClick={() => setTab('needs_review')}
					className={clsx(
						'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors inline-flex items-center gap-2',
						tab === 'needs_review'
							? 'border-brand-500 text-brand-600'
							: 'border-transparent text-muted hover:text-dark',
					)}
				>
					Needs review
					{needsReviewCount > 0 && (
						<span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full">
							{needsReviewCount > 99 ? '99+' : needsReviewCount}
						</span>
					)}
				</button>
			</div>

			<div className="card overflow-hidden">
				<div className="px-4 py-3 border-b border-border bg-gray-50/80">
					<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
						<h2 className="text-sm font-semibold text-dark">Transaction activity</h2>
						<div className="flex flex-wrap items-center gap-2">
							{bankStatus?.linked && (
								<button
									type="button"
									onClick={syncBank}
									disabled={syncing}
									className="btn-secondary text-xs gap-1.5"
								>
									<RefreshCw size={14} className={clsx(syncing && 'animate-spin')} />
									Sync
								</button>
							)}
							<button type="button" onClick={exportCsv} className="btn-secondary text-xs gap-1.5">
								<Download size={14} />
								Export
							</button>
							<button
								type="button"
								onClick={() => window.alert('Auto-tagging rules are coming soon. For now, categorize inline or use bulk edit.')}
								className="btn-secondary text-xs gap-1.5"
							>
								<SlidersHorizontal size={14} />
								Manage rules
							</button>
						</div>
					</div>

					<div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:flex-wrap">
						<PageSearchInput
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search transactions…"
							className="w-full sm:w-52"
						/>

						<div className="flex flex-wrap items-center gap-2">
							<FilterPill label={`Date · ${formatDateFilterLabel(filters.date_from, filters.date_to)}`}>
								{(close) => (
									<DateRangeFilterContent
										dateFrom={filters.date_from}
										dateTo={filters.date_to}
										onApply={(range) => setFilters((f) => ({ ...f, ...range }))}
										close={close}
									/>
								)}
							</FilterPill>

							<FilterPill label={filters.account_id ? `Account · ${accounts.find((a) => a.id === filters.account_id)?.label}` : 'Account'}>
								{(close) => (
									<>
										<button
											type="button"
											className="block w-full text-left text-xs px-2 py-1.5 rounded hover:bg-gray-50"
											onClick={() => { setFilters((f) => ({ ...f, account_id: '' })); close(); }}
										>
											All accounts
										</button>
										{accounts.map((a) => (
											<button
												key={a.id}
												type="button"
												className="block w-full text-left text-xs px-2 py-1.5 rounded hover:bg-gray-50 truncate"
												onClick={() => { setFilters((f) => ({ ...f, account_id: a.id })); close(); }}
											>
												{a.label}
											</button>
										))}
									</>
								)}
							</FilterPill>

							<FilterPill label={filters.category ? `Category · ${filters.category}` : 'Category'}>
								{(close) => (
									<div className="min-w-[12rem] max-h-64 overflow-y-auto">
										<button
											type="button"
											className="block w-full text-left text-xs px-2 py-1.5 rounded hover:bg-gray-50"
											onClick={() => { setFilters((f) => ({ ...f, category: '' })); close(); }}
										>
											All categories
										</button>
										{BOOKKEEPING_CATEGORY_GROUPS.map((group) => (
											<div key={group.type}>
												<p className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
													{group.label}
												</p>
												{group.categories.map((c) => (
													<button
														key={c}
														type="button"
														className="block w-full text-left text-xs px-2 py-1.5 rounded hover:bg-gray-50"
														onClick={() => { setFilters((f) => ({ ...f, category: c })); close(); }}
													>
														{c}
													</button>
												))}
											</div>
										))}
									</div>
								)}
							</FilterPill>

							<FilterPill label={filters.property_id ? `Property · ${propertyNameById[filters.property_id] || '…'}` : 'Property'}>
								{(close) => (
									<>
										<button
											type="button"
											className="block w-full text-left text-xs px-2 py-1.5 rounded hover:bg-gray-50"
											onClick={() => { setFilters((f) => ({ ...f, property_id: '' })); close(); }}
										>
											All properties
										</button>
										{properties.map((p) => (
											<button
												key={p.id}
												type="button"
												className="block w-full text-left text-xs px-2 py-1.5 rounded hover:bg-gray-50 truncate max-w-[14rem]"
												onClick={() => { setFilters((f) => ({ ...f, property_id: p.id })); close(); }}
											>
												{getPropertyDisplayName(p) || p.name}
											</button>
										))}
									</>
								)}
							</FilterPill>
						</div>

						<div className="flex flex-wrap items-center gap-4 xl:ml-auto">
							<ToggleSwitch
								label="Uncategorized"
								checked={filters.uncategorizedOnly}
								onChange={(v) => setFilters((f) => ({ ...f, uncategorizedOnly: v }))}
							/>
							<ToggleSwitch
								label="Show excluded"
								checked={filters.showHidden}
								onChange={(v) => setFilters((f) => ({ ...f, showHidden: v }))}
							/>
							{hasActiveFilters && (
								<button type="button" onClick={clearFilters} className="text-xs text-muted hover:text-dark inline-flex items-center gap-1">
									<X size={12} /> Clear
								</button>
							)}
						</div>
					</div>
				</div>

				{selected.size > 0 && (
					<div className="px-4 py-2 bg-brand-50 border-b border-brand-100 flex flex-wrap items-center gap-2 text-xs">
						<span className="font-medium text-brand-800">{selected.size} selected</span>
						<ResettingCategorySelect
							onChange={(v) => bulkPatch({ category: v })}
							className="max-w-[10rem]"
						/>
						<select
							className="select-compact"
							defaultValue=""
							onChange={(e) => {
								if (e.target.value) bulkPatch({ property_id: e.target.value });
								e.target.value = '';
							}}
						>
							<option value="">Set property…</option>
							{properties.map((p) => (
								<option key={p.id} value={p.id}>{getPropertyDisplayName(p) || p.name}</option>
							))}
						</select>
						<button type="button" onClick={() => bulkPatch({ reviewed: true })} className="btn-secondary text-xs py-1">
							Mark reviewed
						</button>
						<button type="button" onClick={() => bulkPatch({ hidden: true })} className="btn-secondary text-xs py-1 gap-1 inline-flex items-center">
							<EyeOff size={12} />
							Exclude from reports
						</button>
						<button type="button" onClick={() => setSelected(new Set())} className="text-muted hover:text-dark ml-auto">
							Clear selection
						</button>
					</div>
				)}

				{error && (
					<div className="mx-4 mt-3 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
						{error}
					</div>
				)}

				{!bankStatus?.linked && bankStatus?.plaidConfigured && (
					<div className="mx-4 mt-3 bg-sky-50 border border-sky-100 text-sky-900 text-sm px-4 py-3 rounded-lg flex flex-wrap items-center justify-between gap-2">
						<span>Connect your bank to import transactions for categorization.</span>
						<button
							type="button"
							onClick={connectBank}
							disabled={connecting}
							className="btn-primary text-xs gap-1.5"
						>
							<Link2 size={14} />
							{connecting ? 'Connecting…' : 'Connect Bank'}
						</button>
					</div>
				)}

				<p className="text-xs text-muted px-4 pt-3">
					Tip: Match bank deposits (green amounts) to Hospitable payouts — link-icon suggestions require the bank date within check-in–check-out and amount within $5.
					Categories are grouped under <span className="font-medium text-green-700">Income</span> or <span className="font-medium text-red-700">Expenses</span> in the picker.
				</p>

				{loading ? (
					<PageLoader message="Loading transactions…" />
				) : displayed.length === 0 ? (
					<p className="text-muted text-sm text-center py-12 px-4">
						{tab === 'needs_review'
							? 'No transactions need review for the current filters.'
							: 'No transactions match your filters. Connect your bank or widen the date range.'}
					</p>
				) : (
					<>
						<div className="space-y-2 px-3 pb-3 pt-2 lg:hidden">
							{sortedDisplayed.map((tx) => (
								<MobileTransactionCard
									key={tx.id}
									tx={tx}
									selected={selected.has(tx.id)}
									propertyName={tx.property_id ? propertyNameById[tx.property_id] : ''}
									onToggleSelect={() => toggleSelect(tx.id)}
									onOpen={() => setDetailTx(tx)}
								/>
							))}
						</div>
						<div className="transactions-table-scroll mt-2 hidden lg:block">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b border-border bg-gray-50/50">
										<th className="table-head table-head-sticky w-10">
											<input
												type="checkbox"
												checked={selected.size === displayed.length && displayed.length > 0}
												onChange={toggleSelectAll}
												aria-label="Select all"
											/>
										</th>
										<SortableTableHead
											sortKey="date"
											label="Date"
											active={sortKey === 'date'}
											direction={sortDir}
											onSort={toggleSort}
											className="table-head-date"
										/>
										<SortableTableHead
											sortKey="account"
											label="Account"
											active={sortKey === 'account'}
											direction={sortDir}
											onSort={toggleSort}
										/>
										<SortableTableHead
											sortKey="description"
											label="Description"
											active={sortKey === 'description'}
											direction={sortDir}
											onSort={toggleSort}
										/>
										<SortableTableHead
											sortKey="amount"
											label="Amount"
											align="right"
											active={sortKey === 'amount'}
											direction={sortDir}
											onSort={toggleSort}
										/>
										<SortableTableHead
											sortKey="category"
											label="Category"
											active={sortKey === 'category'}
											direction={sortDir}
											onSort={toggleSort}
										/>
										<SortableTableHead
											sortKey="property"
											label="Property"
											active={sortKey === 'property'}
											direction={sortDir}
											onSort={toggleSort}
										/>
										<SortableTableHead
											sortKey="reservation"
											label="Reservation"
											active={sortKey === 'reservation'}
											direction={sortDir}
											onSort={toggleSort}
										/>
										<SortableTableHead
											sortKey="note"
											label="Note"
											active={sortKey === 'note'}
											direction={sortDir}
											onSort={toggleSort}
										/>
										<SortableTableHead
											sortKey="reviewed"
											label="Reviewed"
											active={sortKey === 'reviewed'}
											direction={sortDir}
											onSort={toggleSort}
											className="text-center w-16"
										/>
										<SortableTableHead
											sortKey="excluded"
											label="Excluded"
											active={sortKey === 'excluded'}
											direction={sortDir}
											onSort={toggleSort}
											className="text-center w-16"
										/>
									</tr>
								</thead>
								<tbody className="divide-y divide-border">
									{sortedDisplayed.map((tx) => {
										const saving = savingId === tx.id;
										return (
											<tr
												key={tx.id}
												className={clsx(
													'hover:bg-gray-50',
													tx.hidden && 'opacity-50',
													'cursor-pointer',
												)}
												onClick={(e) => {
													const interactive = e.target.closest('button, a, input, select, textarea, [role="button"]');
													if (interactive) return;
													setDetailTx(tx);
												}}
											>
												<td className="table-cell w-10">
													<input
														type="checkbox"
														checked={selected.has(tx.id)}
														onChange={() => toggleSelect(tx.id)}
														aria-label={`Select ${tx.description}`}
													/>
												</td>
												<td className="table-cell-date text-muted">
													{formatDateOrDash(tx.date)}
												</td>
												<td className="table-cell text-muted max-w-[8rem] truncate">
													{tx.account || '—'}
												</td>
												<td className="table-cell max-w-[12rem]">
													<p className="font-medium text-dark truncate">{tx.description}</p>
													{tx.pending && (
														<span className="text-[10px] font-medium text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded">
															Pending
														</span>
													)}
												</td>
												<td
													className={clsx(
														'table-cell text-right font-medium tabular-nums',
														Number(tx.amount) >= 0 ? 'text-green-600' : 'text-red-600',
													)}
												>
													{fmt$(Number(tx.amount))}
												</td>
												<td className="table-cell">
													<div className="flex flex-col gap-1 min-w-[11rem]">
														<CategorySelect
															value={tx.category || ''}
															placeholder="Select category"
															onChange={(v) => patchTx(tx.id, { category: v })}
															className={saving ? 'opacity-60' : ''}
														/>
														{tx.category && (
															<CategoryTypeBadge category={tx.category} />
														)}
													</div>
												</td>
												<td className="table-cell">
													<InlineSelect
														value={tx.property_id || ''}
														placeholder="Select property"
														options={propertyOptions}
														onChange={(v) => patchTx(tx.id, { property_id: v || null })}
														className={saving ? 'opacity-60' : ''}
													/>
												</td>
												<td className="table-cell">
													<ReservationMatchSelect
														tx={tx}
														reservations={reservations}
														reservationById={reservationById}
														reservationRemainingById={reservationRemainingById}
														reservationMatchedIncomeById={reservationMatchedIncomeById}
														disabled={saving}
														onChange={(reservationId) => matchReservation(tx.id, reservationId)}
													/>
												</td>
												<td className="table-cell">
													<input
														type="text"
														className="input-compact w-full max-w-[8rem]"
														placeholder="Add note"
														defaultValue={tx.notes || ''}
														onBlur={(e) => {
															if (e.target.value !== (tx.notes || '')) {
																patchTx(tx.id, { notes: e.target.value });
															}
														}}
													/>
												</td>
												<td className="table-cell text-center">
													<button
														type="button"
														onClick={() => patchTx(tx.id, { reviewed: !tx.reviewed })}
														className={clsx(
															'inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors',
															tx.reviewed
																? 'bg-green-50 border-green-200 text-green-600'
																: 'border-border text-muted hover:border-brand-400 hover:text-brand-600',
														)}
														title={tx.reviewed ? 'Mark as needs review' : 'Mark reviewed'}
													>
														<Check size={14} />
													</button>
												</td>
												<td className="table-cell text-center">
													<button
														type="button"
														onClick={() => patchTx(tx.id, { hidden: !tx.hidden })}
														className={clsx(
															'inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors',
															tx.hidden
																? 'bg-gray-100 border-gray-300 text-dark'
																: 'border-border text-muted hover:border-gray-400 hover:text-dark',
														)}
															title={tx.hidden ? 'Include in reports' : 'Exclude from reports'}
														>
															<EyeOff size={14} />
													</button>
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
