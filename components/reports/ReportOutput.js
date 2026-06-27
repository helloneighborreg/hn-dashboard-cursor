import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Check, ChevronDown, ChevronRight, Circle } from 'lucide-react';
import IncomeStatementTable from './IncomeStatementTable';
import ReportExportBar from './ReportExportBar';
import OwnerStatementPreview from './OwnerStatementPreview';
import ReportDrilldownPanel from './ReportDrilldownPanel';
import AdminPasswordPrompt from '../AdminPasswordPrompt';
import { fmtReport$ } from '../financials/format';
import { formatDateOrDash } from '../../lib/dates';
import {
	filterScheduleEDrilldown,
} from '../../lib/reportDrilldown';
import { canExcludeTransaction, setTransactionExcluded } from '../../lib/bookkeepingClient';
import {
	approveOwnerStatements,
	saveOwnerStatementNotes,
	setOwnerStatementInclusion,
} from '../../lib/ownerStatementClient';
import { buildBlankDraftOwnerStatements, buildDraftOwnerStatements } from '../../lib/ownerStatementDraft';
import { resolvePropertyIds } from '../../lib/propertyGroups';
import { buildOwnerStatementPdfBase64 } from '../../lib/reportPdf';
import { formatStatementMonthLabel } from '../../lib/ownerStatementReport';
import { useAdminPasswordGate } from '../../lib/useAdminPasswordGate';

function SummaryGrid({ items, onAmountClick }) {
	return (
		<div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 px-4 py-2 border-b border-border bg-gray-50/60 text-sm">
			{items.map(({ label, value, tone, raw, field }) => (
				<div key={label} className="inline-flex items-baseline gap-1.5">
					<span className="text-xs font-medium text-muted">{label}</span>
					{raw ? (
						<span className="font-semibold text-dark tabular-nums">{value}</span>
					) : (
						<button
							type="button"
							onClick={() => onAmountClick?.({ field, label })}
							className={clsx(
								'font-semibold tabular-nums hover:underline',
								tone === 'positive' ? 'text-green-600' : tone === 'negative' ? 'text-red-600' : 'text-brand-600',
								!value && 'text-muted no-underline',
							)}
							disabled={!value}
						>
							{fmtReport$(value)}
						</button>
					)}
				</div>
			))}
		</div>
	);
}

function ClickableAmount({ value, onClick }) {
	const n = Number(value) || 0;
	if (!n) return <span className="text-muted">{fmtReport$(0)}</span>;
	return (
		<button
			type="button"
			onClick={onClick}
			className="text-brand-600 hover:text-brand-700 hover:underline tabular-nums font-medium"
		>
			{fmtReport$(n)}
		</button>
	);
}

const OWNER_STATEMENT_HEAD = 'px-4 py-2.5 text-left text-xs font-semibold text-white uppercase tracking-wide';

function CollapsibleSection({ title, open, onToggle, children }) {
	return (
		<div className="border-b border-border last:border-b-0">
			<button
				type="button"
				onClick={onToggle}
				className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-dark hover:bg-gray-50 transition-colors"
			>
				{open ? <ChevronDown size={16} className="shrink-0 text-muted" /> : <ChevronRight size={16} className="shrink-0 text-muted" />}
				{title}
			</button>
			{open && children}
		</div>
	);
}

function InclusionStatusButton({
	included,
	disabled,
	onMarkComplete,
	onMarkIncomplete,
	labelComplete = 'Complete',
	labelIncomplete = 'Incomplete',
}) {
	return (
		<button
			type="button"
			onClick={disabled ? undefined : (included ? onMarkIncomplete : onMarkComplete)}
			disabled={disabled}
			className={clsx(
				'inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium transition-colors',
				included
					? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
					: 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100',
				disabled && 'opacity-50',
			)}
			title={included ? labelComplete : labelIncomplete}
			aria-label={included ? labelComplete : labelIncomplete}
			aria-pressed={included}
		>
			{included ? (
				<>
					<Check size={14} aria-hidden />
					Complete
				</>
			) : (
				<>
					<Circle size={8} className="fill-current" aria-hidden />
					Incomplete
				</>
			)}
		</button>
	);
}


function OwnerStatementsView({ data, onRefresh, statementStatus = 'all', filters = {}, properties = [] }) {
	const [drilldown, setDrilldown] = useState(null);
	const [togglingId, setTogglingId] = useState(null);
	const [savingNotesId, setSavingNotesId] = useState(null);
	const [toggleError, setToggleError] = useState('');
	const [selectedIds, setSelectedIds] = useState(() => new Set());
	const [reservationsOpen, setReservationsOpen] = useState(true);
	const [previewStatements, setPreviewStatements] = useState(null);
	const [approving, setApproving] = useState(false);
	const [previewError, setPreviewError] = useState('');
	const [unlockedReservationIds, setUnlockedReservationIds] = useState(() => new Set());
	const {
		prompt: passwordPrompt,
		closePrompt,
		submitPrompt,
		withAdminPassword,
	} = useAdminPasswordGate();

	const reservations = useMemo(() => {
		const rows = (data.reservations || []).filter((row) => !row.statement_locked);
		if (statementStatus === 'complete') {
			return rows.filter((row) => row.included_on_statement);
		}
		if (statementStatus === 'incomplete') {
			return rows.filter((row) => !row.included_on_statement);
		}
		return rows;
	}, [data.reservations, statementStatus]);

	const allReservations = (data.reservations || []).filter((row) => !row.statement_locked);
	const reservationCount = allReservations.length;
	const completeCount = data.summary?.complete_count
		?? allReservations.filter((row) => row.included_on_statement).length;
	const incompleteCount = data.summary?.incomplete_count
		?? (reservationCount - completeCount);

	const canGenerate = selectedIds.size > 0;
	const blankPropertyIds = useMemo(() => {
		const ids = resolvePropertyIds(properties, filters);
		return ids?.length === 1 ? ids : [];
	}, [properties, filters]);
	const canGenerateBlank = blankPropertyIds.length === 1;

	function toggleSelected(id, checked) {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (checked) next.add(id);
			else next.delete(id);
			return next;
		});
	}

	function handleGenerate() {
		if (!canGenerate) return;
		const statements = buildDraftOwnerStatements(data, [...selectedIds]);
		if (!statements.length) return;
		setPreviewStatements(statements);
		setPreviewError('');
	}

	function handleGenerateBlank() {
		if (!canGenerateBlank) return;
		const statements = buildBlankDraftOwnerStatements(data, blankPropertyIds);
		if (!statements.length) return;
		setPreviewStatements(statements);
		setPreviewError('');
	}

	async function handleApprove(approvedStatements) {
		const statements = approvedStatements?.length ? approvedStatements : previewStatements;
		if (!statements?.length) return;
		setApproving(true);
		setPreviewError('');
		try {
			const pdfs = await Promise.all(statements.map(async (statement) => ({
				property_id: statement.property_id,
				pdf_base64: await buildOwnerStatementPdfBase64([statement], data.manager),
			})));
			await approveOwnerStatements({
				statements,
				pdfs,
				date_from: data.filters?.date_from,
				date_to: data.filters?.date_to,
			});
			setPreviewStatements(null);
			setSelectedIds(new Set());
			await onRefresh?.();
		} catch (err) {
			setPreviewError(err.message);
		} finally {
			setApproving(false);
		}
	}

	function handleDiscard() {
		setPreviewStatements(null);
		setPreviewError('');
	}

	function openReservation(row, openMonthPicker = false) {
		setToggleError('');
		setDrilldown({
			title: row.code || 'Reservation',
			subtitle: [row.guest_name, row.property_name]
				.filter(Boolean)
				.join(' · '),
			items: [row],
			variant: 'owner-statement',
			openMonthPicker,
		});
	}

	function isReservationLocked(row) {
		return Boolean(row?.statement_locked)
			|| (Boolean(row?.included_on_statement) && !unlockedReservationIds.has(row.id));
	}

	function unlockReservation(rowId) {
		setUnlockedReservationIds((prev) => {
			const next = new Set(prev);
			next.add(rowId);
			return next;
		});
	}

	async function requestUnlock(row, options = {}) {
		const password = await withAdminPassword(async (value) => value, options);
		unlockReservation(row.id);
		return password;
	}

	async function toggleInclusion(row, included, statementMonth, adminPassword) {
		setTogglingId(row.id);
		setToggleError('');
		try {
			let password = adminPassword;
			if (row.included_on_statement && !included) {
				password = password || await requestUnlock(row, {
					title: 'Unlock to remove reservation',
					description: 'This reservation is on an owner statement. Enter an admin password to remove it.',
				});
			}

			await setOwnerStatementInclusion({
				property_id: row.property_id,
				reservation_id: row.id,
				statement_month: statementMonth || row.statement_month,
				included,
				admin_password: password,
			});
			await onRefresh?.();
			if (drilldown?.items?.[0]?.id === row.id) {
				setDrilldown((prev) => (prev ? {
					...prev,
					openMonthPicker: false,
					items: [{
						...row,
						included_on_statement: included,
						statement_month: included ? (statementMonth || row.statement_month) : null,
						statement_month_label: included
							? (statementMonth ? formatStatementMonthLabel(statementMonth) : row.statement_month_label)
							: '',
					}],
				} : null));
			}
		} catch (err) {
			if (err.message !== 'Cancelled') {
				setToggleError(err.message);
			}
		} finally {
			setTogglingId(null);
		}
	}

	async function saveNotes(row, notes, adminPassword) {
		setSavingNotesId(row.id);
		setToggleError('');
		try {
			let password = adminPassword;
			if (row.included_on_statement) {
				password = password || await requestUnlock(row, {
					title: 'Unlock to edit notes',
					description: 'This reservation is on an owner statement. Enter an admin password to edit notes.',
				});
			}

			await saveOwnerStatementNotes({
				property_id: row.property_id,
				reservation_id: row.id,
				notes,
				admin_password: password,
			});
			await onRefresh?.();
			if (drilldown?.items?.[0]?.id === row.id) {
				setDrilldown((prev) => (prev ? {
					...prev,
					items: [{ ...row, statement_notes: notes }],
				} : null));
			}
		} catch (err) {
			if (err.message !== 'Cancelled') {
				setToggleError(err.message);
			}
			throw err;
		} finally {
			setSavingNotesId(null);
		}
	}

	return (
		<>
			<div className="card overflow-hidden">
				<ReportExportBar data={data} hideExport />
				<SummaryGrid
					items={[
						{ label: 'Reservations', value: reservationCount, raw: true },
						{ label: 'Complete', value: completeCount, raw: true },
						{ label: 'Incomplete', value: incompleteCount, raw: true },
					]}
				/>
				{toggleError && (
					<p className="px-4 py-2 text-xs text-red-600 border-b border-border bg-red-50">{toggleError}</p>
				)}
				<CollapsibleSection
					title="Reservations"
					open={reservationsOpen}
					onToggle={() => setReservationsOpen((open) => !open)}
				>
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead className="bg-gray-600">
								<tr>
									<th className={clsx(OWNER_STATEMENT_HEAD, 'w-10')}>
										<span className="sr-only">Select</span>
									</th>
									<th className={OWNER_STATEMENT_HEAD}>Reservation ID</th>
									<th className={OWNER_STATEMENT_HEAD}>Property</th>
									<th className={OWNER_STATEMENT_HEAD}>Guest</th>
									<th className={clsx(OWNER_STATEMENT_HEAD, 'px-2')}>Check-in</th>
									<th className={clsx(OWNER_STATEMENT_HEAD, 'px-2')}>Check-out</th>
									<th className={clsx(OWNER_STATEMENT_HEAD, 'text-center')}>Status</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{reservations.length === 0 ? (
									<tr>
										<td colSpan={7} className="table-cell text-center text-sm text-muted py-8">
											No reservations match the selected filters.
										</td>
									</tr>
								) : reservations.map((row) => (
									<tr
										key={row.id}
										className="hover:bg-gray-50 cursor-pointer"
										onClick={() => openReservation(row)}
									>
										<td
											className="table-cell w-10"
											onClick={(e) => e.stopPropagation()}
										>
											<input
												type="checkbox"
												checked={selectedIds.has(row.id)}
												disabled={row.statement_locked}
												onChange={(e) => toggleSelected(row.id, e.target.checked)}
												className="rounded text-brand-500 disabled:opacity-40"
												aria-label={`Select ${row.code || 'reservation'}`}
											/>
										</td>
										<td className="table-cell font-mono text-xs">{row.code || '—'}</td>
										<td className="table-cell">{row.property_name}</td>
										<td className="table-cell">{row.guest_name || '—'}</td>
										<td className="table-cell-date">{formatDateOrDash(row.check_in)}</td>
										<td className="table-cell-date">{formatDateOrDash(row.check_out)}</td>
										<td className="table-cell text-center">
											<InclusionStatusButton
												included={row.included_on_statement}
												disabled={togglingId === row.id}
												onMarkComplete={() => openReservation(row, true)}
												onMarkIncomplete={() => toggleInclusion(row, false)}
											/>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</CollapsibleSection>
				<div className="px-4 py-4 border-t border-border flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-sm text-muted">
						{selectedIds.size > 0
							? `${selectedIds.size} reservation${selectedIds.size === 1 ? '' : 's'} selected`
							: canGenerateBlank
								? 'Select reservations, or generate a blank statement with manual entries only.'
								: 'Select reservations to generate an owner statement, or choose one property for a blank statement.'}
					</p>
					<div className="flex flex-wrap gap-2 self-start sm:self-auto">
						{canGenerateBlank && (
							<button
								type="button"
								onClick={handleGenerateBlank}
								className="btn-secondary text-sm"
								title="Generate a statement with no reservations — add manual transactions in the preview"
							>
								Blank Statement
							</button>
						)}
						<button
							type="button"
							onClick={handleGenerate}
							disabled={!canGenerate}
							className="btn-primary text-sm disabled:opacity-50"
						>
							Add to Statement
						</button>
					</div>
				</div>
			</div>
			<ReportDrilldownPanel
				title={drilldown?.title}
				subtitle={drilldown?.subtitle}
				items={drilldown?.items}
				variant={drilldown?.variant}
				openMonthPicker={drilldown?.openMonthPicker}
				onClose={() => setDrilldown(null)}
				onToggleInclusion={toggleInclusion}
				togglingId={togglingId}
				onSaveNotes={saveNotes}
				savingNotesId={savingNotesId}
				isReservationLocked={isReservationLocked}
				onRequestUnlock={requestUnlock}
			/>
			<AdminPasswordPrompt
				open={Boolean(passwordPrompt)}
				title={passwordPrompt?.title}
				description={passwordPrompt?.description}
				onSubmit={submitPrompt}
				onCancel={closePrompt}
				submitting={passwordPrompt?.submitting}
				error={passwordPrompt?.error}
			/>
			<OwnerStatementPreview
				statements={previewStatements}
				onApprove={handleApprove}
				onDiscard={handleDiscard}
				approving={approving}
				error={previewError}
			/>
		</>
	);
}

function BalanceSheetView({ data }) {
	return (
		<div className="card overflow-hidden">
			<ReportExportBar data={data} />
			<div className="p-4 pt-3">
				{data.note && (
					<p className="text-sm text-muted mb-4 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
						{data.note}
					</p>
				)}
				<div className="grid lg:grid-cols-3 gap-4">
					{[
						{ title: 'Assets', rows: data.assets, total: data.totals.assets },
						{ title: 'Liabilities', rows: data.liabilities, total: data.totals.liabilities },
						{ title: 'Equity', rows: data.equity, total: data.totals.equity },
					].map((section) => (
						<div key={section.title} className="card p-5">
							<h2 className="font-semibold text-dark mb-4">{section.title}</h2>
							<ul className="space-y-2 text-sm">
								{section.rows.map((row) => (
									<li key={row.label} className="flex justify-between gap-3">
										<span className="text-muted">{row.label}</span>
										<span className="font-medium text-dark tabular-nums">{fmtReport$(row.amount)}</span>
									</li>
								))}
							</ul>
							<div className="border-t border-border mt-4 pt-3 flex justify-between font-semibold">
								<span>Total {section.title.toLowerCase()}</span>
								<span className="tabular-nums">{fmtReport$(section.total)}</span>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

function ScheduleEView({ data, onRefresh, properties = [] }) {
	const [drilldown, setDrilldown] = useState(null);
	const [excludingId, setExcludingId] = useState(null);
	const items = data.drilldown_items || [];

	const drilldownItems = useMemo(() => {
		if (!drilldown?.scheduleLine) return [];
		return filterScheduleEDrilldown(items, drilldown.scheduleLine);
	}, [drilldown, items]);

	function openLine(row) {
		if (!row.amount) return;
		setDrilldown({
			title: `Schedule E — Line ${row.line}`,
			subtitle: row.label,
			scheduleLine: row.line,
		});
	}

	async function handleItemSaved() {
		await onRefresh?.();
	}

	async function excludeItem(item) {
		if (!canExcludeTransaction(item)) return;
		setExcludingId(item.id);
		try {
			await setTransactionExcluded(item.id, true);
			setDrilldown((prev) => (prev ? {
				...prev,
				items: prev.items.filter((row) => row.id !== item.id),
			} : null));
			await onRefresh?.();
		} finally {
			setExcludingId(null);
		}
	}

	return (
		<>
			<div className="card overflow-hidden">
				<ReportExportBar data={data} />
				<SummaryGrid
					items={[
						{ label: 'Rental income', value: data.summary.total_income, tone: 'positive' },
						{ label: 'Expenses', value: data.summary.total_expenses, tone: 'negative' },
						{ label: 'Net rental income', value: data.summary.net_rental_income, tone: data.summary.net_rental_income >= 0 ? 'positive' : 'negative' },
					]}
				/>
				<div className="overflow-x-auto">
					<table className="w-full">
						<thead>
							<tr className="border-b border-border">
								<th className="table-head">Line</th>
								<th className="table-head">Category</th>
								<th className="table-head text-right">Amount</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{data.lines.map((row) => (
								<tr key={row.line} className="hover:bg-gray-50">
									<td className="table-cell tabular-nums">{row.line}</td>
									<td className="table-cell">{row.label}</td>
									<td className="table-cell text-right">
										<ClickableAmount value={row.amount} onClick={() => openLine(row)} />
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
			<ReportDrilldownPanel
				title={drilldown?.title}
				subtitle={drilldown?.subtitle}
				items={drilldownItems}
				properties={properties}
				onClose={() => setDrilldown(null)}
				onItemUpdated={handleItemSaved}
				onExcludeItem={excludeItem}
				excludingId={excludingId}
			/>
		</>
	);
}

function IncomeStatementView({ data, onRefresh, properties }) {
	return <IncomeStatementTable data={data} onRefresh={onRefresh} properties={properties} />;
}

export default function ReportOutput({ data, onRefresh, properties = [], filters = {} }) {
	if (!data) return null;

	switch (data.report) {
		case 'owner-statements':
			return (
				<OwnerStatementsView
					data={data}
					onRefresh={onRefresh}
					statementStatus={filters.statement_status || 'all'}
					filters={filters}
					properties={properties}
				/>
			);
		case 'net-cash-flow':
		case 'noi':
		case 'inflow-outflow':
			return <IncomeStatementView data={data} onRefresh={onRefresh} properties={properties} />;
		case 'balance-sheet':
			return <BalanceSheetView data={data} />;
		case 'schedule-e':
			return <ScheduleEView data={data} onRefresh={onRefresh} properties={properties} />;
		default:
			return null;
	}
}
