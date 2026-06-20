import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import clsx from 'clsx';
import { FileBarChart } from 'lucide-react';
import ReportFilters from './ReportFilters';
import { PageLoader, ErrorState } from '../LoadingSpinner';
import PageActionButtons from '../PageActionButtons';
import { fetchJson } from '../../lib/apiClient';
import { startOfYearIso, todayIso } from '../../lib/dates';
import { resolvePropertyIds } from '../../lib/propertyGroups';
import { REPORT_TYPES, normalizeReportId, reportById } from '../../lib/reportDefinitions';
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
	};
}

export default function ReportsPage() {
	const router = useRouter();
	const reportId = useMemo(
		() => normalizeReportId(router.query?.report),
		[router.query?.report],
	);
	const activeReport = reportById(reportId);

	const [properties, setProperties] = useState([]);
	const [filters, setFilters] = useState(defaultFilters);
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

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
		load();
	}, [router.isReady, reportId]);

	function selectReport(id) {
		const query = { ...router.query, report: id };
		router.push({ pathname: '/reports', query }, undefined, { shallow: true });
	}

	return (
		<>
			<div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h1 className="text-2xl font-bold text-dark">Reports</h1>
					<p className="text-muted text-sm mt-0.5">Generate financial and owner reports</p>
				</div>
				<PageActionButtons onRefresh={() => load()} refreshing={loading} />
			</div>

			<div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-6">
				{REPORT_TYPES.map((report) => {
					const selected = report.id === reportId;
					return (
						<button
							key={report.id}
							type="button"
							onClick={() => selectReport(report.id)}
							className={clsx(
								'text-left card p-4 transition-all border',
								selected
									? 'border-brand-400 ring-2 ring-brand-100 bg-brand-50/40'
									: 'border-border hover:border-brand-300 hover:shadow-card-hover',
							)}
						>
							<div className="flex items-start gap-3">
								<div className={clsx(
									'p-2 rounded-lg flex-shrink-0',
									selected ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-500',
								)}
								>
									<FileBarChart size={18} />
								</div>
								<div className="min-w-0">
									<p className="font-semibold text-dark text-sm">{report.label}</p>
									<p className="text-xs text-muted mt-1 line-clamp-2">{report.description}</p>
								</div>
							</div>
						</button>
					);
				})}
			</div>

			<div className="mb-6">
				<h2 className="text-lg font-semibold text-dark mb-1">{activeReport.label}</h2>
				<p className="text-sm text-muted">{activeReport.description}</p>
			</div>

			<ReportFilters
				filters={filters}
				properties={properties}
				onChange={setFilters}
				onApply={load}
				reportId={reportId}
			/>

			{loading && <PageLoader message="Generating report…" />}
			{error && !loading && <ErrorState message={error} onRetry={() => load()} />}
			{!loading && !error && <ReportOutput data={data} onRefresh={() => load()} />}
		</>
	);
}
