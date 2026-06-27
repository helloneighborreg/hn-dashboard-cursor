import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import { fetchJson } from '../lib/apiClient';
import { formatDateOrDash } from '../lib/dates';
import { getOwnerStatement, voidOwnerStatement } from '../lib/ownerStatementClient';
import { fmtReport$ } from './financials/format';
import OwnerStatementPreview from './reports/OwnerStatementPreview';
import { useAuth } from './AuthContext';

export default function PropertyOwnerStatementsSection({ propertyId, embedded = false }) {
	const { isAdmin } = useAuth();
	const [rows, setRows] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [previewStatements, setPreviewStatements] = useState(null);
	const [approvalMeta, setApprovalMeta] = useState(null);
	const [openingId, setOpeningId] = useState(null);
	const [previewError, setPreviewError] = useState('');
	const [voiding, setVoiding] = useState(false);

	const loadRows = useCallback(() => {
		if (!propertyId) return Promise.resolve();
		setLoading(true);
		setError('');
		return fetchJson(`/api/properties/${propertyId}/owner-statements`)
			.then((json) => setRows(json?.data || []))
			.catch((err) => setError(err.message))
			.finally(() => setLoading(false));
	}, [propertyId]);

	useEffect(() => {
		loadRows();
	}, [loadRows]);

	async function openStatement(row) {
		if (!isAdmin || openingId) return;
		setOpeningId(row.id);
		setPreviewError('');
		try {
			const json = await getOwnerStatement(row.id);
			const data = json?.data;
			if (!data?.statement) {
				throw new Error('Statement data is unavailable.');
			}
			setApprovalMeta({
				id: data.id,
				approved_at: data.approved_at,
				has_pdf: data.has_pdf,
			});
			setPreviewStatements([{
				...data.statement,
				property_id: data.property_id,
				statement_period: data.statement_period || data.statement.statement_period,
			}]);
		} catch (err) {
			setPreviewError(err.message);
		} finally {
			setOpeningId(null);
		}
	}

	function closePreview() {
		setPreviewStatements(null);
		setApprovalMeta(null);
		setPreviewError('');
	}

	async function handleVoid() {
		if (!approvalMeta?.id || voiding) return;
		const label = rows.find((row) => row.id === approvalMeta.id)?.statement_period || 'this statement';
		if (!window.confirm(
			`Void ${label}? This unlocks its reservations and transactions and deletes the saved PDF.`,
		)) {
			return;
		}

		setVoiding(true);
		setPreviewError('');
		try {
			await voidOwnerStatement(approvalMeta.id);
			closePreview();
			await loadRows();
		} catch (err) {
			setPreviewError(err.message);
		} finally {
			setVoiding(false);
		}
	}

	const content = (
		<>
			{loading && <p className="text-sm text-muted">Loading statements…</p>}
			{error && <p className="text-sm text-red-600">{error}</p>}
			{previewError && !previewStatements && (
				<p className="text-sm text-red-600">{previewError}</p>
			)}

			{!loading && !error && rows.length === 0 && (
				<p className="text-sm text-muted">No approved owner statements yet.</p>
			)}

			{rows.length > 0 && (
				<div className="space-y-2">
					{rows.map((row) => {
						const opening = openingId === row.id;
						const details = (
							<>
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
								{isAdmin && (
									<p className="text-xs text-brand-600 mt-1">
										{opening ? 'Opening…' : 'Click to view statement'}
									</p>
								)}
							</>
						);

						return (
							<div
								key={row.id}
								className={[
									'flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5',
									isAdmin ? 'hover:border-brand-300 hover:bg-brand-50/40 transition-colors' : '',
									opening ? 'opacity-70' : '',
								].filter(Boolean).join(' ')}
							>
								{isAdmin ? (
									<button
										type="button"
										onClick={() => openStatement(row)}
										disabled={opening}
										className="min-w-0 flex-1 text-left cursor-pointer disabled:cursor-wait"
									>
										{details}
									</button>
								) : (
									<div className="min-w-0 flex-1">{details}</div>
								)}
								{row.has_pdf ? (
									<a
										href={`/api/owner-statements/${row.id}/pdf`}
										target="_blank"
										rel="noopener noreferrer"
										onClick={(event) => event.stopPropagation()}
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
						);
					})}
				</div>
			)}

			{previewStatements && (
				<OwnerStatementPreview
					mode="approved"
					statements={previewStatements}
					approvalMeta={approvalMeta}
					onDiscard={closePreview}
					onVoid={handleVoid}
					voiding={voiding}
					error={previewError}
				/>
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
