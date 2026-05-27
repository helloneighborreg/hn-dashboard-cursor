import { fmt$, fmtPct } from './format';

export default function FinancialsTables({ data }) {
	return (
		<>
			{data.property_profitability?.length > 0 && (
				<div className="card p-5 mb-6">
					<h2 className="font-semibold text-dark mb-4">Property Profitability Report</h2>
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr className="border-b border-border">
									<th className="table-head">Property</th>
									<th className="table-head text-right">Revenue</th>
									<th className="table-head text-right">Expenses</th>
									<th className="table-head text-right">Net Income</th>
									<th className="table-head text-right">Margin</th>
									<th className="table-head text-right">Occupancy</th>
									<th className="table-head text-right">ADR</th>
									<th className="table-head text-right">RevPAR</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{data.property_profitability.map((p) => (
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
			)}
		</>
	);
}
