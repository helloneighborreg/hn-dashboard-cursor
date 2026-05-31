import { useState, useEffect } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout';
import PageActionButtons from '../components/PageActionButtons';
import { PageLoader, ErrorState } from '../components/LoadingSpinner';
import FinancialsFilters from '../components/financials/FinancialsFilters';
import IncomePanel from '../components/financials/IncomePanel';
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

export default function IncomePage() {
	const [data, setData] = useState(null);
	const [properties, setProperties] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
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
			<Head><title>Income — Hello Neighbor</title></Head>
			<Layout title="">
				<div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<h1 className="text-2xl font-bold text-dark">Income</h1>
						<p className="text-muted text-sm mt-0.5">
							Hospitable imports and bank feed revenue
						</p>
					</div>
					<PageActionButtons onRefresh={() => load()} refreshing={loading} />
				</div>

				<FinancialsFilters
					filters={filters}
					properties={properties}
					onChange={setFilters}
					onApply={load}
				/>

				{loading && <PageLoader message="Loading income…" />}
				{error && <ErrorState message={error} retry={load} />}

				{data && !loading && (
					<IncomePanel
						data={data}
						summary={data.summary}
						dateFrom={filters.date_from}
						dateTo={filters.date_to}
					/>
				)}
			</Layout>
		</>
	);
}

export const getServerSideProps = requireAuth(async () => ({ props: {} }));
