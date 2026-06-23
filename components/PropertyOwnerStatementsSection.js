import { useEffect, useState } from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import { fetchJson } from '../lib/apiClient';
import { formatDateOrDash } from '../lib/dates';
import { fmtReport$ } from './financials/format';

export default function PropertyOwnerStatementsSection({ propertyId, embedded = false }) {
	const [rows, setRows] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	useEffect(() => {
		if (!propertyId) return;
		setLoading(true);
		setError('');
		fetchJson(`/api/properties/${propertyId}/owner-statements`)
			.then((json) => setRows(json?.data || []))
			.catch((err) => setError(err.message))
			.finally(() => setLoading(false));
	}, [propertyId]);

	const content = (
		<>
			{loading && <p className="text-sm text-muted">Loading statements…</p>}
			{error && <p className="text-sm text-red-600">{error}</p>}

			{!loading && !error && rows.length === 0 && (
				<p className="text-sm text-muted">No approved owner statements yet.</p>
			)}

			{rows.length > 0 && (
				<div className="space-y-2">
					{rows.map((row) => (
						<div
							key={row.id}
							className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
						>
							<div className="min-w-0">
								<p className="text-sm font-medium text-dark truncate">
									{row.statement_period || 'Owner Statement'}
								</p>
								<p className="text-xs text-muted mt-0.5">
									Approved {formatDateOrDash(row.approved_at?.slice?.(0, 10) || row.approved_at)}
									{' · '}
									{row.reservation_count} reservation{row.reservation_count === 1 ? '' : 's'}
									{' · '}
									{fmtReport$(row.total_due_to_owner)}
								</p>
							</div>
							{row.has_pdf ? (
								<a
									href={`/api/owner-statements/${row.id}/pdf`}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-1.5 shrink-0 text-sm font-medium text-brand-600 hover:text-brand-700 px-2 py-1 rounded-md hover:bg-brand-50"
									title="View PDF"
								>
									<FileText size={16} aria-hidden />
									<span className="hidden sm:inline">View PDF</span>
									<ExternalLink size={12} className="opacity-60" aria-hidden />
								</a>
							) : (
								<span className="text-xs text-muted shrink-0">No PDF</span>
							)}
						</div>
					))}
				</div>
			)}
		</>
	);

	if (embedded) return content;

	return (
		<div className="card p-6 mb-4">
			<div className="flex items-start justify-between gap-3 mb-4">
				<div>
					<h2 className="font-semibold text-dark text-sm uppercase tracking-wide text-muted">
						Owner Statements
					</h2>
					<p className="text-xs text-muted mt-1">
						Approved owner statements for this property.
					</p>
				</div>
			</div>
			{content}
		</div>
	);
}
