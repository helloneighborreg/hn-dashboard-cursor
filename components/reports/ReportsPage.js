import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import clsx from 'clsx';
import { Star } from 'lucide-react';
import ReportFilters from './ReportFilters';
import ReportPicker from './ReportPicker';
import { PageLoader, ErrorState } from '../LoadingSpinner';
import PageActionButtons from '../PageActionButtons';
import { fetchJson } from '../../lib/apiClient';
import { startOfYearIso, todayIso } from '../../lib/dates';
import { resolvePropertyIds } from '../../lib/propertyGroups';
import { REPORT_TYPES, normalizeReportId } from '../../lib/reportDefinitions';
import {
	readReportFavorites,
	toggleReportFavorite,
	writeReportFavorites,
} from '../../lib/reportFavorites';
import ReportOutput from './ReportOutput';

function defaultFilters() {
	return {
		property_mode: 'all',
		property: '',
		property_group: '',
		property_ids: [],
		date_preset: 'this_year',
		date_from: startOfYearIso(),
		date_to: todayIso(),
		interval: 'month',
		category_level: 'subcategory',
		statement_status: 'all',
	};
}

export default function ReportsPage() {
	const router = useRouter();
	const reportId = useMemo(
		() => normalizeReportId(router.query?.report),
		[router.query?.report],
	);

	const [properties, setProperties] = useState([]);
	const [filters, setFilters] = useState(defaultFilters);
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [favorites, setFavorites] = useState([]);

	useEffect(() => {
		setFavorites(readReportFavorites());
	}, []);

	useEffect(() => {
		fetchJson('/api/properties')
			.then((json) => { if (json) setProperties(json.data || []); })
			.catch(() => setProperties([]));
	}, []);

	const load = useCallback(async (overrides = {}) => {
		const active = { ...filters, ...overrides };
		if (
			overrides.property_mode !== undefined
			|| overrides.property !== undefined
			|| overrides.property_group !== undefined
			|| overrides.property_ids !== undefined
			|| overrides.date_from !== undefined
			|| overrides.date_to !== undefined
			|| overrides.date_preset !== undefined
			|| overrides.interval !== undefined
			|| overrides.category_level !== undefined
		) {
			setFilters(active);
		}

		setLoading(true);
		setError('');

		if (!reportId) {
			setLoading(false);
			return;
		}

		if (active.property_mode === 'one' && !active.property?.trim()) {
			setError('Select a property to run this report.');
			setLoading(false);
			return;
		}
		if (active.property_mode === 'custom' && !(active.property_ids?.length)) {
			setError('Select at least one property for a custom report.');
			setLoading(false);
			return;
		}

		try {
			const propertyIds = resolvePropertyIds(properties, active);
			const params = new URLSearchParams({ report: reportId });
			if (propertyIds?.length) params.set('properties', propertyIds.join(','));
			if (active.date_from) params.set('date_from', active.date_from);
			if (active.date_to) params.set('date_to', active.date_to);
			if (active.interval) params.set('interval', active.interval);
			if (active.category_level) params.set('category_level', active.category_level);
			const json = await fetchJson(`/api/reports?${params}`);
			if (json) setData(json.data);
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	}, [filters, reportId, properties]);

	useEffect(() => {
		if (!router.isReady) return;
		if (!reportId) {
			setLoading(false);
			setError('');
			setData(null);
			return;
		}
		load();
	}, [router.isReady, reportId]);

	function selectReport(id) {
		const query = { ...router.query, report: id };
		router.push({ pathname: '/reports', query }, undefined, { shallow: true });
	}

	function handleToggleFavorite(id) {
		setFavorites((prev) => {
			const next = toggleReportFavorite(prev, id);
			writeReportFavorites(next);
			return next;
		});
	}

	const favoriteReports = useMemo(
		() => REPORT_TYPES.filter((report) => favorites.includes(report.id)),
		[favorites],
	);

	return (
		<div className="-mt-1 lg:-mt-3">
			<div className="flex flex-col gap-2 mb-3">
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 min-w-0 flex-1">
						<h1 className="text-xl font-bold text-dark shrink-0">Reports</h1>
						<ReportPicker
							reportId={reportId}
							favorites={favorites}
							onSelect={selectReport}
							onToggleFavorite={handleToggleFavorite}
						/>
					</div>
					<PageActionButtons onRefresh={() => reportId && load()} refreshing={loading && Boolean(reportId)} />
				</div>

				{favoriteReports.length > 0 && (
					<div className="flex flex-wrap items-center gap-1.5">
						<span className="text-[11px] font-medium text-muted uppercase tracking-wide mr-0.5">Favorites</span>
						{favoriteReports.map((report) => {
							const selected = report.id === reportId;
							const favorited = favorites.includes(report.id);
							return (
								<div key={report.id} className="inline-flex items-center">
									<button
										type="button"
										onClick={() => selectReport(report.id)}
										className={clsx(
											'text-xs px-2.5 py-1 rounded-l-full border font-medium transition-colors',
											selected
												? 'border-brand-400 bg-brand-50 text-brand-700'
												: 'border-border text-muted hover:border-brand-300 hover:text-brand-600',
										)}
									>
										{report.label}
									</button>
									<button
										type="button"
										onClick={() => handleToggleFavorite(report.id)}
										className={clsx(
											'text-xs px-1.5 py-1 rounded-r-full border border-l-0 transition-colors',
											selected
												? 'border-brand-400 bg-brand-50'
												: 'border-border hover:border-brand-300',
											favorited
												? 'text-amber-500 hover:text-amber-600'
												: 'text-gray-300 hover:text-amber-400',
										)}
										aria-label={`Remove ${report.label} from favorites`}
										aria-pressed={favorited}
									>
										<Star size={12} className={clsx(favorited && 'fill-current')} />
									</button>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{reportId && (
				<ReportFilters
					filters={filters}
					properties={properties}
					onChange={setFilters}
					onApply={load}
					reportId={reportId}
				/>
			)}

			{reportId && loading && <PageLoader message="Generating report…" compact />}
			{reportId && error && !loading && <ErrorState message={error} onRetry={() => load()} compact />}
			{reportId && !loading && !error && (
				<ReportOutput
					data={data}
					onRefresh={() => load()}
					properties={properties}
					filters={filters}
				/>
			)}
			{!reportId && (
				<div className="card p-6 text-center text-muted text-sm">
					Select a report to generate.
				</div>
			)}
		</div>
	);
}
