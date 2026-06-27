import clsx from 'clsx';
import { Plus } from 'lucide-react';
import { fmtReport$ } from '../financials/format';
import { formatDateOrDash } from '../../lib/dates';
import { categoryLabel } from '../../lib/bookkeepingCategories';

const TABLE_HEAD = 'px-3 py-2 text-left text-xs font-semibold text-white uppercase tracking-wide';
const TABLE_HEAD_COMPACT = 'px-2.5 py-1.5 text-left text-[11px] font-semibold text-white uppercase tracking-wide';

const TRANSACTION_TABLE_HEAD = (
	<tr>
		<th className={TABLE_HEAD}>Date</th>
		<th className={TABLE_HEAD}>Property</th>
		<th className={TABLE_HEAD}>Category</th>
		<th className={TABLE_HEAD}>Notes</th>
		<th className={clsx(TABLE_HEAD, 'text-right')}>Amount</th>
		<th className={clsx(TABLE_HEAD, 'text-center')}>
			<span className="sr-only">Action</span>
		</th>
	</tr>
);

function transactionRowCells(row) {
	return (
		<>
			<td className="table-cell-date align-top">{formatDateOrDash(row.date)}</td>
			<td className="table-cell whitespace-nowrap align-top">{row.property_name || '—'}</td>
			<td className="table-cell whitespace-nowrap align-top">{labelForRow(row)}</td>
			<td className="table-cell whitespace-normal align-top">{notesLabel(row)}</td>
			<td className="table-cell text-right tabular-nums font-medium whitespace-nowrap align-top">
				{fmtReport$(row.amount)}
			</td>
		</>
	);
}

function notesLabel(row) {
	if (row.source === 'manual') return row.notes?.trim() || '—';
	if (row.kind === 'adjustment') return 'Adjustment';
	return 'Bank transaction';
}

function rowKey(row) {
	return `${row.kind}:${row.id}`;
}

function isSelected(row, selection) {
	if (!selection) return false;
	if (row.kind === 'adjustment') {
		return selection.adjustmentIds?.has(row.id) ?? false;
	}
	return selection.transactionIds?.has(row.id) ?? false;
}

function labelForRow(row) {
	if (row.category) return categoryLabel(row.category);
	if (row.kind === 'adjustment') return row.reason || 'Adjustment';
	return '—';
}

/** Additional items not yet on the statement — added items move to the summary above. */
export function OwnerStatementAdditionalItemsList({
	transactions = [],
	adjustments = [],
	selection,
	onToggle,
}) {
	const rows = [
		...(transactions || []).map((row) => ({ ...row, kind: 'transaction' })),
		...(adjustments || []).map((row) => ({ ...row, kind: 'adjustment' })),
	]
		.filter((row) => !isSelected(row, selection))
		.sort((a, b) => String(a.date).localeCompare(String(b.date)));

	if (!rows.length) {
		return (
			<p className="text-sm text-muted py-3">
				No additional transactions or expenses available.
			</p>
		);
	}

	return (
		<div className="overflow-x-auto border border-border rounded-lg">
			<table className="w-max min-w-full table-auto text-sm">
				<thead className="bg-gray-600">
					{TRANSACTION_TABLE_HEAD}
				</thead>
				<tbody className="divide-y divide-border">
					{rows.map((row) => (
						<tr key={rowKey(row)}>
							{transactionRowCells(row)}
							<td className="table-cell text-center whitespace-nowrap">
								<button
									type="button"
									onClick={() => onToggle?.(row, true)}
									className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-green-200 bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors"
								>
									<Plus size={14} aria-hidden />
									Add
								</button>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

/** Added items summary table (between reservations and picker). */
export function OwnerStatementAddedItems({
	items = [],
	onRemove,
	readOnly = false,
	compact = false,
}) {
	const rows = [...items].sort((a, b) => String(a.date).localeCompare(String(b.date)));
	if (!rows.length) return null;

	const total = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
	const headClass = compact ? TABLE_HEAD_COMPACT : TABLE_HEAD;
	const hideContextColumns = readOnly && compact;

	return (
		<div className={compact ? 'space-y-1.5' : 'space-y-2'}>
			<div className="overflow-x-auto border border-border rounded-lg">
				<table className="w-full table-auto text-sm">
					<thead className="bg-gray-600">
						{readOnly ? (
							<tr>
								{!hideContextColumns && <th className={headClass}>Date</th>}
								{!hideContextColumns && <th className={headClass}>Property</th>}
								<th className={headClass}>Category</th>
								<th className={headClass}>Notes</th>
								<th className={clsx(headClass, 'text-right')}>Amount</th>
							</tr>
						) : TRANSACTION_TABLE_HEAD}
					</thead>
					<tbody className="divide-y divide-border">
						{rows.map((row) => (
							<tr key={rowKey(row)} className="bg-green-50/40">
								{hideContextColumns ? (
									<>
										<td className="table-cell whitespace-nowrap align-top">{labelForRow(row)}</td>
										<td className="table-cell whitespace-normal align-top">{notesLabel(row)}</td>
										<td className="table-cell text-right tabular-nums font-medium whitespace-nowrap align-top">
											{fmtReport$(row.amount)}
										</td>
									</>
								) : (
									transactionRowCells(row)
								)}
								{!readOnly && (
									<td className="table-cell text-center whitespace-nowrap">
										<button
											type="button"
											onClick={() => onRemove?.(row)}
											className="inline-flex items-center px-2 py-1 rounded-md border border-red-200 bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors"
										>
											Remove
										</button>
									</td>
								)}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<div className={clsx('flex justify-end text-sm', compact && 'text-xs')}>
				<span className="text-muted mr-2">Adjustments Subtotal</span>
				<span className="font-semibold tabular-nums text-dark">{fmtReport$(total)}</span>
			</div>
		</div>
	);
}

export default OwnerStatementAdditionalItemsList;
