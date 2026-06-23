import { useMemo } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { fmt$ } from './format';
import { formatDateOrDash } from '../../lib/dates';
import { sortByKey } from '../../lib/tableSort';
import { useTableSort } from './useTableSort';
import { SortableTableHead } from './SortableTableHead';
import OwnerStatementInclusionBadge from './OwnerStatementInclusionBadge';

const NUMERIC_KEYS = new Set(['amount']);

function getExpenseSortValue(expense, key) {
	switch (key) {
		case 'date': return expense.date || '';
		case 'property': return expense.property_name || expense.property_id || '';
		case 'category': return expense.category || '';
		case 'vendor': return expense.vendor || '';
		case 'notes': return expense.notes || '';
		case 'amount': return expense.amount || 0;
		default: return '';
	}
}

export default function ExpensesTable({ expenses, summary, onAddExpense, onSelectExpense }) {
	const { sortKey, sortDir, toggleSort } = useTableSort('date', 'desc');

	const sortedExpenses = useMemo(
		() => sortByKey(expenses || [], sortKey, sortDir, getExpenseSortValue, { numericKeys: NUMERIC_KEYS }),
		[expenses, sortKey, sortDir],
	);

	return (
		<div className="card p-5">
			<div className="flex items-center justify-between mb-4">
				<h2 className="font-semibold text-dark">
					Manual Expenses{expenses?.length ? ` (${expenses.length})` : ''}
				</h2>
				<button type="button" onClick={onAddExpense} className="btn-secondary text-xs gap-1">
					<Plus size={14} /> Add
				</button>
			</div>
			{expenses?.length > 0 ? (
				<div className="overflow-x-auto">
					<table className="w-full">
						<thead>
							<tr className="border-b border-border">
								<SortableTableHead sortKey="date" label="Date" active={sortKey === 'date'} direction={sortDir} onSort={toggleSort} className="table-head-date" />
								<SortableTableHead sortKey="property" label="Property" active={sortKey === 'property'} direction={sortDir} onSort={toggleSort} />
								<SortableTableHead sortKey="category" label="Category" active={sortKey === 'category'} direction={sortDir} onSort={toggleSort} />
								<SortableTableHead sortKey="vendor" label="Vendor" active={sortKey === 'vendor'} direction={sortDir} onSort={toggleSort} />
								<SortableTableHead sortKey="notes" label="Notes" active={sortKey === 'notes'} direction={sortDir} onSort={toggleSort} />
								<SortableTableHead label="Owner statement" sortable={false} />
								<SortableTableHead sortKey="amount" label="Amount" align="right" active={sortKey === 'amount'} direction={sortDir} onSort={toggleSort} />
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{sortedExpenses.map((e) => (
								<tr
									key={e.id}
									className="hover:bg-gray-50 cursor-pointer group"
									onClick={() => onSelectExpense?.(e)}
								>
									<td className="table-cell-date">{formatDateOrDash(e.date)}</td>
									<td className="table-cell truncate max-w-xs">{e.property_name || e.property_id}</td>
									<td className="table-cell">{e.category}</td>
									<td className="table-cell text-muted">{e.vendor || '—'}</td>
									<td className="table-cell text-muted text-xs truncate max-w-xs">{e.notes || '—'}</td>
									<td className="table-cell">
										<OwnerStatementInclusionBadge inclusion={e.owner_statement_inclusion} />
									</td>
									<td className="table-cell text-right font-medium text-red-600">
										<span className="inline-flex items-center gap-2 justify-end">
											{fmt$(e.amount)}
											<Pencil
												size={14}
												className="text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
												aria-hidden
											/>
										</span>
									</td>
								</tr>
							))}
							<tr className="border-t-2 border-red-200 font-semibold">
								<td className="table-cell" colSpan={6}>Total Expenses</td>
								<td className="table-cell text-right text-red-600">{fmt$(summary?.total_expenses)}</td>
							</tr>
						</tbody>
					</table>
				</div>
			) : (
				<p className="text-muted text-sm text-center py-10">
					No manual expenses for the selected period.
				</p>
			)}
		</div>
	);
}
