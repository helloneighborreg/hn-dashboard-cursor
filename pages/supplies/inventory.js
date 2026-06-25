import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { RefreshCw } from 'lucide-react';
import Layout from '../../components/Layout';
import PageSearchInput from '../../components/PageSearchInput';
import SupplyInventoryCard from '../../components/supplies/SupplyInventoryCard';
import { PageLoader, ErrorState, EmptyState } from '../../components/LoadingSpinner';
import { fetchJson } from '../../lib/apiClient';
import { requireAuth } from '../../lib/auth';

export default function SuppliesInventoryPage() {
	const [items, setItems] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [search, setSearch] = useState('');
	const [locationFilter, setLocationFilter] = useState('');

	async function load() {
		setLoading(true);
		setError('');
		try {
			const json = await fetchJson('/api/supplies/inventory');
			setItems(json?.data || []);
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => { load(); }, []);

	const locations = useMemo(
		() => [...new Set(items.map((i) => i.location).filter(Boolean))].sort(),
		[items],
	);

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		return items.filter((item) => {
			if (locationFilter && item.location !== locationFilter) return false;
			if (!q) return true;
			const title = item.product?.title?.toLowerCase() || '';
			const category = item.product?.category?.toLowerCase() || '';
			const loc = item.location?.toLowerCase() || '';
			return title.includes(q) || category.includes(q) || loc.includes(q);
		});
	}, [items, search, locationFilter]);

	return (
		<>
			<Head><title>Inventory — Supplies — Hello Neighbor</title></Head>
			<Layout title="">
				<div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<h1 className="text-xl sm:text-2xl font-bold text-dark">Inventory</h1>
					</div>
					<button
						type="button"
						onClick={load}
						disabled={loading}
						className="btn-secondary text-xs gap-1.5 self-start"
					>
						<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
						Refresh
					</button>
				</div>

				<div className="flex flex-col sm:flex-row gap-3 mb-6">
					<PageSearchInput
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search inventory…"
						className="flex-1 w-full sm:w-auto"
					/>
					{locations.length > 0 && (
						<select
							className="input sm:w-48"
							value={locationFilter}
							onChange={(e) => setLocationFilter(e.target.value)}
						>
							<option value="">All locations</option>
							{locations.map((loc) => (
								<option key={loc} value={loc}>{loc}</option>
							))}
						</select>
					)}
				</div>

				{loading && <PageLoader message="Loading inventory…" />}
				{error && <ErrorState message={error} retry={load} />}
				{!loading && !error && filtered.length === 0 && (
					<EmptyState title="No inventory yet" />
				)}
				{!loading && !error && filtered.length > 0 && (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
						{filtered.map((item) => (
							<SupplyInventoryCard key={item.id} item={item} />
						))}
					</div>
				)}
			</Layout>
		</>
	);
}

export const getServerSideProps = requireAuth(async () => ({ props: {} }));
