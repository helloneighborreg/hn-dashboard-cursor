import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import PageSearchInput from '../components/PageSearchInput';
import { PageLoader, ErrorState } from '../components/LoadingSpinner';
import { fetchJson } from '../lib/apiClient';
import { requireAuth } from '../lib/auth';

const TYPE_LABELS = {
	page: 'Pages',
	task: 'Tasks',
	property: 'Properties',
	expense: 'Transactions',
};

function groupResults(results) {
	const groups = {};
	for (const item of results) {
		const key = item.type || 'other';
		if (!groups[key]) groups[key] = [];
		groups[key].push(item);
	}
	return groups;
}

export default function SearchPage() {
	const router = useRouter();
	const [query, setQuery] = useState('');
	const [results, setResults] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');

	async function runSearch(q) {
		const trimmed = q.trim();
		setQuery(trimmed);
		if (trimmed.length < 2) {
			setResults([]);
			setError('');
			return;
		}

		setLoading(true);
		setError('');
		try {
			const json = await fetchJson(`/api/search?q=${encodeURIComponent(trimmed)}`);
			setResults(json?.data?.results || []);
		} catch (err) {
			setError(err.message);
			setResults([]);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		if (!router.isReady) return;
		const q = typeof router.query.q === 'string' ? router.query.q : '';
		setQuery(q);
		if (q.trim().length >= 2) runSearch(q);
	}, [router.isReady, router.query.q]);

	function handleSubmit(e) {
		e.preventDefault();
		const next = query.trim();
		router.push(next ? `/search?q=${encodeURIComponent(next)}` : '/search', undefined, { shallow: true });
		runSearch(next);
	}

	const grouped = groupResults(results);

	return (
		<>
			<Head><title>Search — Hello Neighbor</title></Head>
			<Layout title="">
				<div className="mb-4">
					<h1 className="text-xl sm:text-2xl font-bold text-dark">Search</h1>
				</div>

				<form onSubmit={handleSubmit} className="mb-4 max-w-md">
					<PageSearchInput
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search tasks, properties, pages…"
						className="w-full"
					/>
				</form>

				{loading && <PageLoader message="Searching…" />}
				{error && <ErrorState message={error} retry={() => runSearch(query)} />}

				{!loading && !error && query.trim().length >= 2 && results.length === 0 && (
					<p className="text-sm text-muted">No results for &ldquo;{query}&rdquo;</p>
				)}

				{!loading && !error && results.length > 0 && (
					<div className="space-y-5">
						{Object.entries(grouped).map(([type, items]) => (
							<section key={type}>
								<h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
									{TYPE_LABELS[type] || type}
								</h2>
								<ul className="card divide-y divide-border">
									{items.map((item) => (
										<li key={`${type}-${item.id}`}>
											<Link
												href={item.href}
												className="block px-4 py-2.5 hover:bg-gray-50 transition-colors"
											>
												<p className="text-sm font-medium text-dark">{item.label}</p>
												{item.subtitle && (
													<p className="text-xs text-muted mt-0.5">{item.subtitle}</p>
												)}
											</Link>
										</li>
									))}
								</ul>
							</section>
						))}
					</div>
				)}
			</Layout>
		</>
	);
}

export const getServerSideProps = requireAuth();
