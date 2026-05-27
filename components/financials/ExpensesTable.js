import { Plus } from 'lucide-react';
import { fmt$ } from './format';
import { formatDateOrDash } from '../../lib/dates';

export default function ExpensesTable({ expenses, summary, onAddExpense }) {
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
								<th className="table-head">Date</th>
								<th className="table-head">Created</th>
								<th className="table-head">Property</th>
								<th className="table-head">Category</th>
								<th className="table-head">Vendor</th>
								<th className="table-head">Notes</th>
								<th className="table-head text-right">Amount</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{expenses.map((e) => (
								<tr key={e.id} className="hover:bg-gray-50">
									<td className="table-cell">{formatDateOrDash(e.date)}</td>
									<td className="table-cell text-muted">{formatDateOrDash(e.created_at)}</td>
									<td className="table-cell truncate max-w-xs">{e.property_name || e.property_id}</td>
									<td className="table-cell">{e.category}</td>
									<td className="table-cell text-muted">{e.vendor || '—'}</td>
									<td className="table-cell text-muted text-xs truncate max-w-xs">{e.notes || '—'}</td>
									<td className="table-cell text-right font-medium text-red-600">{fmt$(e.amount)}</td>
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
