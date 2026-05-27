import { useState, useEffect } from 'react';
import Head from 'next/head';
import { RefreshCw, Plus } from 'lucide-react';
import Layout from '../components/Layout';
import { PageLoader, ErrorState } from '../components/LoadingSpinner';
import ExpenseModal from '../components/ExpenseModal';
import FinancialsFilters from '../components/financials/FinancialsFilters';
import ExpensesTable from '../components/financials/ExpensesTable';
import { fetchJson } from '../lib/apiClient';
import { requireAuth } from '../lib/auth';
import { startOfYearIso, todayIso } from '../lib/dates';

function defaultDateFilters() {
	return {
		property: '',
		date_from: startOfYearIso(),
		date_to: todayIso(),
	};
}

export default function ExpensesPage() {
	const [data, setData] = useState(null);
	const [properties, setProperties] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [showExpenseModal, setShowExpenseModal] = useState(false);
	const [filters, setFilters] = useState(defaultDateFilters);

	useEffect(() => {
		fetchJson('/api/properties')
			.then((json) => { if (json) setProperties(json.data || []); })
			.catch(() => setProperties([]));
	}, []);

	async function load(overrides = {}) {
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

	useEffect(() => { load(); }, []);

	return (
		<>
			<Head><title>Expenses — Hello Neighbor</title></Head>
			<Layout title="">
				{showExpenseModal && (
					<ExpenseModal
						properties={properties}
						title="Add Manual Expense"
						onClose={() => setShowExpenseModal(false)}
						onSaved={load}
					/>
				)}

				<div className="flex items-start justify-between mb-6 gap-4">
					<div>
						<h1 className="text-2xl font-bold text-dark">Expenses</h1>
						<p className="text-muted text-sm mt-0.5">
							Manual expense entries by property and category
						</p>
					</div>
					<div className="flex gap-2 flex-shrink-0">
						<button
							type="button"
							onClick={() => setShowExpenseModal(true)}
							className="btn-primary gap-1.5 text-sm"
						>
							<Plus size={16} /> Add Expense
						</button>
						<button type="button" onClick={() => load()} className="btn-secondary text-xs gap-1.5">
							<RefreshCw size={14} /> Refresh
						</button>
					</div>
				</div>

				<FinancialsFilters
					filters={filters}
					properties={properties}
					onChange={setFilters}
					onApply={load}
				/>

				{loading && <PageLoader message="Loading expenses…" />}
				{error && <ErrorState message={error} retry={load} />}

				{data && !loading && (
					<ExpensesTable
						expenses={data.expenses}
						summary={data.summary}
						onAddExpense={() => setShowExpenseModal(true)}
					/>
				)}
			</Layout>
		</>
	);
}

export const getServerSideProps = requireAuth(async () => ({ props: {} }));
