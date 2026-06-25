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

function PropertyMetric({ label, value, tone = 'dark' }) {
	return (
		<div>
			<p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
			<p className={`mt-0.5 text-sm font-semibold ${tone === 'red' ? 'text-red-600' : tone === 'green' ? 'text-green-600' : 'text-dark'}`}>
				{value}
			</p>
		</div>
	);
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
			<div className="space-y-3 lg:hidden">
				{sortedRows.map((p) => (
					<div key={p.property_id} className="rounded-xl border border-border bg-white p-4">
						<p className="font-semibold text-dark">{p.property_name}</p>
						<div className="mt-3 grid grid-cols-2 gap-3">
							<PropertyMetric label="Revenue" value={fmt$(p.revenue)} tone="green" />
							<PropertyMetric label="Expenses" value={fmt$(p.expenses)} tone="red" />
							<PropertyMetric
								label="Net income"
								value={fmt$(p.net_income)}
								tone={p.net_income >= 0 ? 'green' : 'red'}
							/>
							<PropertyMetric label="Margin" value={fmtPct(p.margin_pct || 0)} />
							<PropertyMetric label="Occupancy" value={fmtPct(p.occupancy_rate || 0)} />
							<PropertyMetric label="ADR / RevPAR" value={`${fmt$(p.adr)} / ${fmt$(p.revpar)}`} />
						</div>
					</div>
				))}
			</div>
			<div className="table-scroll hidden lg:block">
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
