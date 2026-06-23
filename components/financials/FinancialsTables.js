import { useMemo } from 'react';
import { fmt$, fmtPct } from './format';
import { sortByKey } from '../../lib/tableSort';
import { useTableSort } from './useTableSort';
import { SortableTableHead } from './SortableTableHead';

const COLUMNS = [
	{ key: 'property_name', label: 'Property' },
	{ key: 'revenue', label: 'Revenue', align: 'right', numeric: true },
	{ key: 'expenses', label: 'Expenses', align: 'right', numeric: true },
	{ key: 'net_income', label: 'Net Income', align: 'right', numeric: true },
	{ key: 'margin_pct', label: 'Margin', align: 'right', numeric: true },
	{ key: 'occupancy_rate', label: 'Occupancy', align: 'right', numeric: true },
	{ key: 'adr', label: 'ADR', align: 'right', numeric: true },
	{ key: 'revpar', label: 'RevPAR', align: 'right', numeric: true },
];

const NUMERIC_KEYS = new Set(COLUMNS.filter((c) => c.numeric).map((c) => c.key));

function getPropertySortValue(row, key) {
	if (key === 'property_name') return row.property_name || '';
	return row[key] || 0;
}

export default function FinancialsTables({ data }) {
	const { sortKey, sortDir, toggleSort } = useTableSort('revenue', 'desc');

	const sortedRows = useMemo(
		() => sortByKey(
			data.property_profitability || [],
			sortKey,
			sortDir,
			getPropertySortValue,
			{ numericKeys: NUMERIC_KEYS },
		),
		[data.property_profitability, sortKey, sortDir],
	);

	if (!data.property_profitability?.length) return null;

	return (
		<div className="card p-5 mb-6">
			<h2 className="font-semibold text-dark mb-4">Property Profitability Report</h2>
			<div className="overflow-x-auto">
				<table className="w-full">
					<thead>
						<tr className="border-b border-border">
							{COLUMNS.map(({ key, label, align }) => (
								<SortableTableHead
									key={key}
									sortKey={key}
									label={label}
									align={align || 'left'}
									active={sortKey === key}
									direction={sortDir}
									onSort={toggleSort}
								/>
							))}
						</tr>
					</thead>
					<tbody className="divide-y divide-border">
						{sortedRows.map((p) => (
							<tr key={p.property_id} className="hover:bg-gray-50">
								<td className="table-cell">{p.property_name}</td>
								<td className="table-cell text-right">{fmt$(p.revenue)}</td>
								<td className="table-cell text-right text-red-600">{fmt$(p.expenses)}</td>
								<td className={`table-cell text-right font-medium ${p.net_income >= 0 ? 'text-green-600' : 'text-red-600'}`}>
									{fmt$(p.net_income)}
								</td>
								<td className="table-cell text-right">{fmtPct(p.margin_pct || 0)}</td>
								<td className="table-cell text-right">{fmtPct(p.occupancy_rate || 0)}</td>
								<td className="table-cell text-right">{fmt$(p.adr)}</td>
								<td className="table-cell text-right">{fmt$(p.revpar)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
