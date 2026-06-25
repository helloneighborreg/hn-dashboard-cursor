import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import clsx from 'clsx';
import Layout from '../components/Layout';
import FinancialsFilters from '../components/financials/FinancialsFilters';
import BookkeepingPage from '../components/bookkeeping/BookkeepingPage';
import ExpensesTable from '../components/financials/ExpensesTable';
import HospitableTransactionsTable from '../components/financials/HospitableTransactionsTable';
import ExpenseModal from '../components/ExpenseModal';
import ManualExpenseDetailModal from '../components/ManualExpenseDetailModal';
import { PageLoader, ErrorState } from '../components/LoadingSpinner';
import { fetchJson } from '../lib/apiClient';
import { requireAuth } from '../lib/auth';
import { startOfYearIso, todayIso } from '../lib/dates';

const TABS = [
	{ value: 'bank', label: 'Bank (Bookkeeping)' },
	{ value: 'manual', label: 'Manual expenses' },
	{ value: 'hospitable', label: 'Hospitable income' },
];

function defaultDateFilters() {
	return {
		property: '',
		date_from: startOfYearIso(),
		date_to: todayIso(),
	};
}

function normalizeTab(value) {
	const v = String(value || '').toLowerCase();
	return TABS.some((t) => t.value === v) ? v : 'bank';
}

export default function TransactionsPage() {
	const router = useRouter();
	const tab = useMemo(() => normalizeTab(router.query?.tab), [router.query?.tab]);

	const [data, setData] = useState(null);
	const [properties, setProperties] = useState([]);
	const [loading, setLoading] = useState(tab !== 'bank');
	const [error, setError] = useState('');
	const [filters, setFilters] = useState(defaultDateFilters);
	const [showExpenseModal, setShowExpenseModal] = useState(false);
	const [selectedExpense, setSelectedExpense] = useState(null);

	useEffect(() => {
		fetchJson('/api/properties')
			.then((json) => { if (json) setProperties(json.data || []); })
			.catch(() => setProperties([]));
	}, []);

	async function load(overrides = {}) {
		if (tab === 'bank') return;

		const active = { ...filters, ...overrides };
		if (
			overrides.property !== undefined
			|| overrides.date_from !== undefined
			|| overrides.date_to !== undefined
		) {
			setFilters(active);
		}

		setLoading(true);
		setError('');
		try {
			const params = new URLSearchParams();
			if (active.property) params.set('property', active.property);
			if (active.date_from) params.set('date_from', active.date_from);
			if (active.date_to) params.set('date_to', active.date_to);
			const json = await fetchJson('/api/financials?' + params);
			if (json) setData(json.data);
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		if (tab !== 'bank') load();
	}, [tab]);

	async function handleExpenseSaved(updated) {
		const active = { ...filters };
		setLoading(true);
		setError('');
		try {
			const params = new URLSearchParams();
			if (active.property) params.set('property', active.property);
			if (active.date_from) params.set('date_from', active.date_from);
			if (active.date_to) params.set('date_to', active.date_to);
			const json = await fetchJson('/api/financials?' + params);
			if (json) setData(json.data);
			if (updated?.id) {
				const stillVisible = json?.data?.expenses?.find((e) => e.id === updated.id);
				setSelectedExpense(stillVisible || null);
			}
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	}

	async function handleExpenseDeleted() {
		setSelectedExpense(null);
		await load();
	}

	function setTab(nextTab) {
		const query = { ...router.query, tab: nextTab };
		router.push({ pathname: '/transactions', query }, undefined, { shallow: true });
	}

	return (
		<>
			<Head><title>Transactions — Hello Neighbor</title></Head>
			<Layout title="">
				{showExpenseModal && (
					<ExpenseModal
						properties={properties}
						title="Add Manual Expense"
						onClose={() => setShowExpenseModal(false)}
						onSaved={load}
					/>
				)}

				{selectedExpense && (
					<ManualExpenseDetailModal
						expense={selectedExpense}
						properties={properties}
						onClose={() => setSelectedExpense(null)}
						onSaved={handleExpenseSaved}
						onDeleted={handleExpenseDeleted}
					/>
				)}

				<div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<h1 className="text-xl sm:text-2xl font-bold text-dark">Transactions</h1>
						<p className="text-muted text-sm mt-0.5">
							Bank activity, manual expenses, and Hospitable payouts in one place
						</p>
					</div>
				</div>

				<div className="flex flex-wrap gap-1 border-b border-border mb-4">
					{TABS.map(({ value, label }) => (
						<button
							key={value}
							type="button"
							onClick={() => setTab(value)}
							className={clsx(
								'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
								tab === value
									? 'border-brand-500 text-brand-600'
									: 'border-transparent text-muted hover:text-dark',
							)}
						>
							{label}
						</button>
					))}
				</div>

				{tab !== 'bank' && (
					<FinancialsFilters
						filters={filters}
						properties={properties}
						onChange={setFilters}
						onApply={load}
					/>
				)}

				{tab === 'bank' ? (
					<BookkeepingPage />
				) : (
					<>
						{loading && <PageLoader message="Loading transactions…" />}
						{error && <ErrorState message={error} retry={load} />}

						{tab === 'manual' && data && !loading && (
							<ExpensesTable
								expenses={data.expenses}
								summary={data.summary}
								onAddExpense={() => setShowExpenseModal(true)}
								onSelectExpense={setSelectedExpense}
							/>
						)}

						{tab === 'hospitable' && data && !loading && (
							<div className="card p-5">
								<HospitableTransactionsTable
									reservations={data.reservations}
									summary={data.summary}
								/>
							</div>
						)}
					</>
				)}
			</Layout>
		</>
	);
}

export const getServerSideProps = requireAuth(async () => ({ props: {} }));
