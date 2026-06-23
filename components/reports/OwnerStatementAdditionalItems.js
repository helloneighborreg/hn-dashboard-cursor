import clsx from 'clsx';
import { Plus } from 'lucide-react';
import { fmtReport$ } from '../financials/format';
import { formatDateOrDash } from '../../lib/dates';
import { categoryLabel } from '../../lib/bookkeepingCategories';

const TABLE_HEAD = 'px-4 py-2.5 text-left text-xs font-semibold text-white uppercase tracking-wide';

function sourceLabel(row) {
	if (row.kind === 'adjustment') return 'Adjustment';
	if (row.source === 'manual') return 'Manual expense';
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

/** All additional items — Add when unselected, Remove when selected. */
export function OwnerStatementAdditionalItemsList({
	transactions = [],
	adjustments = [],
	selection,
	onToggle,
}) {
	const rows = [
		...(transactions || []).map((row) => ({ ...row, kind: 'transaction' })),
		...(adjustments || []).map((row) => ({ ...row, kind: 'adjustment' })),
	].sort((a, b) => String(a.date).localeCompare(String(b.date)));

	if (!rows.length) {
		return (
			<p className="text-sm text-muted py-3">
				No additional transactions or expenses available.
			</p>
		);
	}

	return (
		<div className="overflow-x-auto border border-border rounded-lg">
			<table className="w-full text-sm">
				<thead className="bg-gray-600">
					<tr>
						<th className={TABLE_HEAD}>Date</th>
						<th className={TABLE_HEAD}>Property</th>
						<th className={TABLE_HEAD}>Type</th>
						<th className={TABLE_HEAD}>Category</th>
						<th className={clsx(TABLE_HEAD, 'text-right')}>Amount</th>
						<th className={clsx(TABLE_HEAD, 'text-center w-28')}>
							<span className="sr-only">Action</span>
						</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-border">
					{rows.map((row) => {
						const selected = isSelected(row, selection);
						return (
							<tr
								key={rowKey(row)}
								className={clsx(selected && 'bg-green-50/40')}
							>
								<td className="table-cell-date">{formatDateOrDash(row.date)}</td>
								<td className="table-cell">{row.property_name || '—'}</td>
								<td className="table-cell">{sourceLabel(row)}</td>
								<td className="table-cell max-w-[220px] truncate">{labelForRow(row)}</td>
								<td className="table-cell text-right tabular-nums font-medium">
									{fmtReport$(row.amount)}
								</td>
								<td className="table-cell text-center">
									{selected ? (
										<button
											type="button"
											onClick={() => onToggle?.(row, false)}
											className="inline-flex items-center px-2 py-1 rounded-md border border-red-200 bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors"
										>
											Remove
										</button>
									) : (
										<button
											type="button"
											onClick={() => onToggle?.(row, true)}
											className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-green-200 bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors"
										>
											<Plus size={14} aria-hidden />
											Add
										</button>
									)}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

/** Added items summary table (between reservations and picker). */
export function OwnerStatementAddedItems({
	items = [],
	onRemove,
}) {
	const rows = [...items].sort((a, b) => String(a.date).localeCompare(String(b.date)));
	if (!rows.length) return null;

	const total = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

	return (
		<div className="space-y-2">
			<div className="overflow-x-auto border border-border rounded-lg">
				<table className="w-full text-sm">
					<thead className="bg-gray-600">
						<tr>
							<th className={TABLE_HEAD}>Date</th>
							<th className={TABLE_HEAD}>Property</th>
							<th className={TABLE_HEAD}>Type</th>
							<th className={TABLE_HEAD}>Category</th>
							<th className={clsx(TABLE_HEAD, 'text-right')}>Amount</th>
							<th className={clsx(TABLE_HEAD, 'text-center w-28')}>
								<span className="sr-only">Remove</span>
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border">
						{rows.map((row) => (
							<tr key={rowKey(row)} className="bg-green-50/40">
								<td className="table-cell-date">{formatDateOrDash(row.date)}</td>
								<td className="table-cell">{row.property_name || '—'}</td>
								<td className="table-cell">{sourceLabel(row)}</td>
								<td className="table-cell max-w-[220px] truncate">{labelForRow(row)}</td>
								<td className="table-cell text-right tabular-nums font-medium">
									{fmtReport$(row.amount)}
								</td>
								<td className="table-cell text-center">
									<button
										type="button"
										onClick={() => onRemove?.(row)}
										className="inline-flex items-center px-2 py-1 rounded-md border border-red-200 bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors"
									>
										Remove
									</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<div className="flex justify-end text-sm">
				<span className="text-muted mr-2">Adjustments subtotal</span>
				<span className="font-semibold tabular-nums text-dark">{fmtReport$(total)}</span>
			</div>
		</div>
	);
}

export default OwnerStatementAdditionalItemsList;
