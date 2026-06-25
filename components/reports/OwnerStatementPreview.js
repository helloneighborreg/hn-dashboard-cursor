import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import Image from 'next/image';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { fmtReport$ } from '../financials/format';
import { formatDateOrDash } from '../../lib/dates';
import { sortByKey } from '../../lib/tableSort';
import { useTableSort } from '../financials/useTableSort';
import { SortableTableHead } from '../financials/SortableTableHead';
import { OwnerStatementAdditionalItemsList, OwnerStatementAddedItems } from './OwnerStatementAdditionalItems';
import {
	applyOwnerStatementItemSelection,
	OWNER_STATEMENT_HN_TOTAL_LABEL,
	OWNER_STATEMENT_MANAGEMENT_FEE_NOTE,
	OWNER_STATEMENT_MANAGER,
	OWNER_STATEMENT_MANAGER_ADDRESS,
	formatAddressTwoLines,
	statementAdjustmentsTotal,
} from '../../lib/ownerStatementReport';
import {
	buildDefaultItemSelections,
	toggleItemSelection,
} from '../../lib/ownerStatementDraft';
import ReportDrilldownPanel from './ReportDrilldownPanel';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { useFocusTrap } from '../../lib/useFocusTrap';

function resolveAddressLines(line1, line2, fallbackAddress) {
	if (line1 || line2) return { line1: line1 || '', line2: line2 || '' };
	return formatAddressTwoLines(fallbackAddress);
}

function CollapsibleSection({ title, open, onToggle, children }) {
	return (
		<div className="border border-border rounded-lg overflow-hidden">
			<button
				type="button"
				onClick={onToggle}
				className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-dark bg-gray-50 hover:bg-gray-100 transition-colors"
			>
				{open ? <ChevronDown size={16} className="shrink-0 text-muted" /> : <ChevronRight size={16} className="shrink-0 text-muted" />}
				{title}
			</button>
			{open && <div className="p-4 pt-2 border-t border-border">{children}</div>}
		</div>
	);
}

function StatementReservationsTable({ reservations, totals, onReservationClick }) {
	const { sortKey, sortDir, toggleSort } = useTableSort('booking_net_revenue', 'desc');
	const numericKeys = useMemo(
		() => new Set([
			'nights',
			'gross_booking_amount',
			'guest_service_fee',
			'reservation_commissions',
			'cleaning_fee',
			'booking_net_revenue',
		]),
		[],
	);

	const sortedReservations = useMemo(
		() => sortByKey(
			reservations || [],
			sortKey,
			sortDir,
			(row, key) => {
				switch (key) {
					case 'code': return row.code || '';
					case 'guest_name': return row.guest_name || '';
					case 'platform': return row.platform_label || row.platform || '';
					case 'dates': return row.check_in || row.date_range || '';
					default: return row[key] || 0;
				}
			},
			{ numericKeys },
		),
		[reservations, sortKey, sortDir, numericKeys],
	);

	if (!reservations?.length) {
		return <p className="text-sm text-muted py-4">No reservations selected.</p>;
	}

	return (
		<div className="overflow-x-auto border border-border rounded-lg">
			<table className="w-full text-sm">
				<thead className="bg-gray-50 border-b border-border">
					<tr>
						<SortableTableHead sortKey="code" label="Reservation" active={sortKey === 'code'} direction={sortDir} onSort={toggleSort} />
						<SortableTableHead sortKey="guest_name" label="Guest" active={sortKey === 'guest_name'} direction={sortDir} onSort={toggleSort} />
						<SortableTableHead sortKey="platform" label="Platform" active={sortKey === 'platform'} direction={sortDir} onSort={toggleSort} />
						<SortableTableHead sortKey="dates" label="Dates" active={sortKey === 'dates'} direction={sortDir} onSort={toggleSort} />
						<SortableTableHead sortKey="nights" label="Nights" align="right" active={sortKey === 'nights'} direction={sortDir} onSort={toggleSort} />
						<SortableTableHead sortKey="gross_booking_amount" label="Gross Booking Amount" align="right" active={sortKey === 'gross_booking_amount'} direction={sortDir} onSort={toggleSort} />
						<SortableTableHead sortKey="guest_service_fee" label="Guest Service Fee" align="right" active={sortKey === 'guest_service_fee'} direction={sortDir} onSort={toggleSort} />
						<SortableTableHead sortKey="reservation_commissions" label="Management Fee" align="right" active={sortKey === 'reservation_commissions'} direction={sortDir} onSort={toggleSort} />
						<SortableTableHead sortKey="cleaning_fee" label="Cleaning Fee" align="right" active={sortKey === 'cleaning_fee'} direction={sortDir} onSort={toggleSort} />
						<SortableTableHead sortKey="booking_net_revenue" label="Booking Net Revenue" align="right" active={sortKey === 'booking_net_revenue'} direction={sortDir} onSort={toggleSort} />
					</tr>
				</thead>
				<tbody className="divide-y divide-border">
					{sortedReservations.map((row) => (
						<tr
							key={row.id}
							className={clsx(onReservationClick && 'hover:bg-gray-50 cursor-pointer')}
							onClick={onReservationClick ? () => onReservationClick(row) : undefined}
						>
							<td className="table-cell font-mono text-xs">{row.code || '—'}</td>
							<td className="table-cell">{row.guest_name || '—'}</td>
							<td className="table-cell">{row.platform_label || row.platform || '—'}</td>
							<td className="table-cell">{row.date_range || formatDateOrDash(row.check_in)}</td>
							<td className="table-cell text-right tabular-nums">{row.nights || '—'}</td>
							<td className="table-cell text-right tabular-nums">{fmtReport$(row.gross_booking_amount)}</td>
							<td className="table-cell text-right tabular-nums">{fmtReport$(row.guest_service_fee)}</td>
							<td className="table-cell text-right tabular-nums">{fmtReport$(row.reservation_commissions)}</td>
							<td className="table-cell text-right tabular-nums">{fmtReport$(row.cleaning_fee)}</td>
							<td className="table-cell text-right tabular-nums">{fmtReport$(row.booking_net_revenue)}</td>
						</tr>
					))}
					<tr className="bg-gray-50 font-semibold">
						<td className="table-cell" colSpan={4} />
						<td className="table-cell text-right tabular-nums">{totals?.total_nights || 0}</td>
						<td className="table-cell text-right tabular-nums">{fmtReport$(totals?.total_gross_booking_amount)}</td>
						<td className="table-cell text-right tabular-nums">{fmtReport$(totals?.total_guest_service_fee)}</td>
						<td className="table-cell text-right tabular-nums">{fmtReport$(totals?.reservation_commissions_to_manager)}</td>
						<td className="table-cell text-right tabular-nums">{fmtReport$(totals?.total_cleaning_fee)}</td>
						<td className="table-cell text-right tabular-nums">{fmtReport$(totals?.total_booking_net_revenue)}</td>
					</tr>
				</tbody>
			</table>
		</div>
	);
}

function StatementSummary({ totals, ownerName }) {
	const adjustmentsTotal = statementAdjustmentsTotal(totals);
	const dueToHnItems = [
		['Management Fee', totals?.reservation_commissions_to_manager],
		['Cleaning Fee', totals?.total_cleaning_fee],
		['Adjustments', adjustmentsTotal],
	];
	const dueToOwnerLabel = ownerName ? `Due to ${ownerName}` : 'Due to Owner';

	return (
		<div className="mt-6 space-y-2 max-w-md ml-auto">
			<div className="flex items-baseline justify-between gap-4 text-sm">
				<span className="text-muted">Net Booking Revenue</span>
				<span className="tabular-nums font-medium text-dark">{fmtReport$(totals?.total_net_revenue)}</span>
			</div>
			<div className="pt-2 space-y-2">
				<p className="text-xs font-semibold uppercase tracking-wide text-muted">
					{OWNER_STATEMENT_HN_TOTAL_LABEL}
				</p>
				{dueToHnItems.map(([label, amount]) => (
					<div key={label} className="flex items-baseline justify-between gap-4 text-sm pl-3">
						<span className="text-muted">{label}</span>
						<span className="tabular-nums font-medium text-dark">{fmtReport$(amount)}</span>
					</div>
				))}
			</div>
			<div className="flex items-baseline justify-between gap-4 bg-dark text-white rounded-md px-4 py-3 mt-3">
				<span className="font-semibold">{dueToOwnerLabel}</span>
				<span className="tabular-nums text-lg font-bold">{fmtReport$(totals?.total_due_to_owner)}</span>
			</div>
		</div>
	);
}

function AddressBlock({ line1, line2, className }) {
	if (!line1 && !line2) return null;
	return (
		<div className={className}>
			{line1 && <p className="text-sm text-muted">{line1}</p>}
			{line2 && <p className="text-sm text-muted">{line2}</p>}
		</div>
	);
}

function StatementPage({
	statement,
	availableTransactions,
	availableAdjustments,
	onPeriodChange,
	onNotesChange,
	selection,
	onToggleAdditionalItem,
	onReservationClick,
}) {
	const [transactionsOpen, setTransactionsOpen] = useState(true);
	const propertyAddress = resolveAddressLines(
		statement.property_address_line1,
		statement.property_address_line2,
		statement.property_address,
	);
	const ownerAddress = resolveAddressLines(
		statement.recipient?.address_line1,
		statement.recipient?.address_line2,
		statement.recipient?.address,
	);
	const hasAdditionalItems = (availableTransactions?.length || 0) + (availableAdjustments?.length || 0) > 0;
	const addedItems = [
		...(statement.transactions || []).map((row) => ({ ...row, kind: 'transaction' })),
		...(statement.adjustments || []).map((row) => ({ ...row, kind: 'adjustment' })),
	];
	const hasAddedItems = addedItems.length > 0;

	return (
		<section className="space-y-4">
			<div className="flex items-start justify-between gap-6">
				<div className="min-w-0 flex-1">
					<p className="text-xs font-semibold uppercase tracking-wide text-muted">Owner Statement</p>
					<input
						type="text"
						value={statement.statement_period || ''}
						onChange={(e) => onPeriodChange(e.target.value)}
						className="mt-1 w-full max-w-lg text-xl font-bold text-dark bg-transparent border-b border-border focus:border-brand-400 focus:outline-none py-0.5"
						aria-label="Statement period"
					/>
					<p className="text-base font-semibold text-dark mt-3">{statement.property_name}</p>
					<AddressBlock
						line1={propertyAddress.line1}
						line2={propertyAddress.line2}
						className="mt-1"
					/>
				</div>
				<div className="shrink-0 text-right max-w-[240px]">
					<Image
						src="/logo.png"
						alt="Hello Neighbor Real Estate Group"
						width={240}
						height={40}
						className="h-16 w-auto ml-auto"
						priority
					/>
					<div className="mt-3">
						<p className="text-sm font-medium text-dark">{OWNER_STATEMENT_MANAGER}</p>
						<AddressBlock
							line1={OWNER_STATEMENT_MANAGER_ADDRESS.line1}
							line2={OWNER_STATEMENT_MANAGER_ADDRESS.line2}
							className="mt-1"
						/>
					</div>
				</div>
			</div>

			<div className="pt-4 border-t border-border max-w-sm">
				<p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">To</p>
				<p className="text-sm font-medium text-dark">{statement.recipient?.name || '—'}</p>
				<AddressBlock
					line1={ownerAddress.line1}
					line2={ownerAddress.line2}
					className="mt-1"
				/>
			</div>

			<StatementReservationsTable
				reservations={statement.reservations}
				totals={statement.totals}
				onReservationClick={onReservationClick}
			/>

			<p className="text-sm text-muted">{OWNER_STATEMENT_MANAGEMENT_FEE_NOTE}</p>

			{hasAddedItems && (
				<div>
					<h4 className="text-sm font-semibold text-dark mb-2">Added Transactions &amp; Expenses</h4>
					<OwnerStatementAddedItems
						items={addedItems}
						onRemove={(row) => onToggleAdditionalItem(row, false)}
					/>
				</div>
			)}

			{hasAdditionalItems && (
				<CollapsibleSection
					title="Add Additional Transactions & Expenses"
					open={transactionsOpen}
					onToggle={() => setTransactionsOpen((open) => !open)}
				>
					<OwnerStatementAdditionalItemsList
						transactions={availableTransactions}
						adjustments={availableAdjustments}
						selection={selection}
						onToggle={(row, included) => onToggleAdditionalItem(row, included)}
					/>
				</CollapsibleSection>
			)}

			<StatementSummary
				totals={statement.totals}
				ownerName={statement.recipient?.name}
			/>

			<div>
				<label className="text-xs font-semibold uppercase tracking-wide text-muted mb-1 block">
					Notes
				</label>
				<textarea
					value={statement.notes || ''}
					onChange={(e) => onNotesChange(e.target.value)}
					rows={3}
					placeholder="Add any notes for this statement…"
					className="w-full text-sm text-dark border border-border rounded-lg px-3 py-2 focus:border-brand-400 focus:outline-none resize-y min-h-[72px]"
				/>
			</div>
		</section>
	);
}

export default function OwnerStatementPreview({
	statements,
	onApprove,
	onDiscard,
	approving = false,
	error = '',
}) {
	useEscapeKey(onDiscard);
	const dialogRef = useFocusTrap(Boolean(statements?.length));
	const [drafts, setDrafts] = useState([]);
	const [itemSelections, setItemSelections] = useState({});
	const [drilldown, setDrilldown] = useState(null);
	const sourceRef = useRef({});

	useEffect(() => {
		if (statements?.length) {
			sourceRef.current = Object.fromEntries(statements.map((statement) => [
				statement.property_id,
				{
					transactions: statement.available_transactions || statement.transactions || [],
					adjustments: statement.available_adjustments || statement.adjustments || [],
				},
			]));
			const defaultSelections = buildDefaultItemSelections(statements);
			setItemSelections(defaultSelections);
			setDrafts(statements.map((statement) => {
				const source = sourceRef.current[statement.property_id] || {};
				return applyOwnerStatementItemSelection({
					...statement,
					transactions: source.transactions,
					adjustments: source.adjustments,
				}, defaultSelections[statement.property_id]);
			}));
		} else {
			sourceRef.current = {};
			setItemSelections({});
			setDrafts([]);
		}
	}, [statements]);

	if (!drafts.length) return null;

	function updateStatement(propertyId, patch) {
		setDrafts((prev) => prev.map((statement) => (
			statement.property_id === propertyId
				? { ...statement, ...patch }
				: statement
		)));
	}

	function openReservation(row) {
		setDrilldown({
			title: row.code || 'Reservation',
			subtitle: [row.guest_name, row.property_name].filter(Boolean).join(' · '),
			items: [row],
		});
	}

	function toggleAdditionalItem(propertyId, row, included) {
		setItemSelections((prev) => {
			const nextSelection = toggleItemSelection(prev[propertyId], row, included);
			setDrafts((prevDrafts) => prevDrafts.map((statement) => {
				if (statement.property_id !== propertyId) return statement;
				const source = sourceRef.current[propertyId] || {};
				return applyOwnerStatementItemSelection({
					...statement,
					transactions: source.transactions,
					adjustments: source.adjustments,
				}, nextSelection);
			}));
			return { ...prev, [propertyId]: nextSelection };
		});
	}

	return (
		<>
			<div
				className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px]"
				onClick={onDiscard}
			/>
			<div
				ref={dialogRef}
				tabIndex={-1}
				role="dialog"
				aria-modal="true"
				aria-label="Owner statement preview"
				className="fixed inset-4 sm:inset-8 md:inset-12 z-50 bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden focus:outline-none"
			>
				<div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
					<div>
						<h2 className="text-lg font-bold text-dark">Owner Statement Preview</h2>
						<p className="text-sm text-muted mt-0.5">
							{drafts.length} propert{drafts.length === 1 ? 'y' : 'ies'} ·{' '}
							{drafts.reduce((n, s) => n + (s.reservations?.length || 0), 0)} reservation
							{drafts.reduce((n, s) => n + (s.reservations?.length || 0), 0) === 1 ? '' : 's'}
						</p>
						{error && <p className="text-xs text-red-600 mt-1">{error}</p>}
					</div>
					<button
						type="button"
						onClick={onDiscard}
						className="p-2 rounded-lg text-muted hover:text-dark hover:bg-gray-100"
						aria-label="Close preview"
					>
						<X size={18} />
					</button>
				</div>

				<div className="flex-1 overflow-y-auto px-5 py-5 space-y-10">
					{drafts.map((statement) => {
						const source = sourceRef.current[statement.property_id] || {};
						return (
							<StatementPage
								key={statement.property_id}
								statement={statement}
								availableTransactions={source.transactions}
								availableAdjustments={source.adjustments}
								onPeriodChange={(value) => updateStatement(statement.property_id, { statement_period: value })}
								onNotesChange={(value) => updateStatement(statement.property_id, { notes: value })}
								selection={itemSelections[statement.property_id]}
								onToggleAdditionalItem={(row, included) => toggleAdditionalItem(statement.property_id, row, included)}
								onReservationClick={openReservation}
							/>
						);
					})}
				</div>

				<div className="shrink-0 border-t border-border px-5 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 bg-white">
					<button
						type="button"
						onClick={onDiscard}
						disabled={approving}
						className={clsx(
							'text-sm px-4 py-2 rounded-md border font-medium transition-colors',
							'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
							approving && 'opacity-50',
						)}
					>
						Discard
					</button>
					<button
						type="button"
						onClick={() => onApprove?.(drafts)}
						disabled={approving}
						className={clsx(
							'text-sm px-4 py-2 rounded-md border font-medium transition-colors',
							'border-green-200 bg-green-600 text-white hover:bg-green-700',
							approving && 'opacity-50',
						)}
					>
						{approving ? 'Approving…' : 'Approve'}
					</button>
				</div>
			</div>
			<ReportDrilldownPanel
				title={drilldown?.title}
				subtitle={drilldown?.subtitle}
				items={drilldown?.items}
				variant="owner-statement"
				stacked
				onClose={() => setDrilldown(null)}
			/>
		</>
	);
}
