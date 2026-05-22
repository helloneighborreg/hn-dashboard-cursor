import { Plus } from 'lucide-react';
import { fmt$, fmtPct } from './format';

export default function FinancialsTables({ data, summary, onAddExpense }) {
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

			{data.reservations?.length > 0 && (
				<div className="card p-5 mb-6">
					<h2 className="font-semibold text-dark mb-4">Reservations ({data.reservations.length})</h2>
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr className="border-b border-border">
									<th className="table-head">Guest</th>
									<th className="table-head">Property</th>
									<th className="table-head">Platform</th>
									<th className="table-head">Check-in</th>
									<th className="table-head">Check-out</th>
									<th className="table-head">Nights</th>
									<th className="table-head text-right">Revenue</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{data.reservations.map((r) => (
									<tr key={r.id} className="hover:bg-gray-50">
										<td className="table-cell">
											<p className="font-medium text-dark">{r.guest_name || '—'}</p>
											<p className="text-xs text-muted font-mono">{r.code}</p>
										</td>
										<td className="table-cell text-sm truncate max-w-xs">{r.property_name}</td>
										<td className="table-cell capitalize">{r.platform_label}</td>
										<td className="table-cell">{r.check_in?.slice(0, 10)}</td>
										<td className="table-cell">{r.check_out?.slice(0, 10)}</td>
										<td className="table-cell">{r.nights}</td>
										<td className="table-cell text-right font-medium">{fmt$(r.revenue)}</td>
									</tr>
								))}
								<tr className="border-t-2 border-brand-200 font-semibold">
									<td className="table-cell" colSpan={6}>Total</td>
									<td className="table-cell text-right text-brand-600">{fmt$(summary?.total_revenue)}</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			)}

			{data.reservations?.length > 0 && (
				<div className="card p-5 mb-6">
					<h2 className="font-semibold text-dark mb-1">Transaction Log</h2>
					<p className="text-xs text-muted mb-4">Revenue breakdown by fee type for each reservation</p>
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-border bg-gray-50">
									<th className="table-head">Guest</th>
									<th className="table-head">Property</th>
									<th className="table-head">Dates</th>
									<th className="table-head text-right">Accommodation</th>
									<th className="table-head text-right">Cleaning</th>
									<th className="table-head text-right">Pet Fee</th>
									<th className="table-head text-right">Other Fees</th>
									<th className="table-head text-right">Taxes</th>
									<th className="table-head text-right">Platform Fees</th>
									<th className="table-head text-right font-semibold">Total</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{data.reservations.map((r) => {
									const otherFees = (r.fee_items || [])
										.filter((f) => !/clean|pet/i.test(f.label))
										.reduce((s, f) => s + f.amount, 0);
									return (
										<tr key={r.id} className="hover:bg-gray-50">
											<td className="table-cell">
												<p className="font-medium text-dark">{r.guest_name || '—'}</p>
												<p className="text-xs text-muted font-mono">{r.code}</p>
											</td>
											<td className="table-cell text-xs text-muted truncate max-w-[140px]">{r.property_name}</td>
											<td className="table-cell text-xs text-muted whitespace-nowrap">
												{r.check_in?.slice(0, 10)} → {r.check_out?.slice(0, 10)}
											</td>
											<td className="table-cell text-right">{r.accommodation_fare > 0 ? fmt$(r.accommodation_fare) : '—'}</td>
											<td className="table-cell text-right">{r.cleaning_fee > 0 ? fmt$(r.cleaning_fee) : '—'}</td>
											<td className="table-cell text-right">{r.pet_fee > 0 ? fmt$(r.pet_fee) : '—'}</td>
											<td className="table-cell text-right">{otherFees > 0 ? fmt$(otherFees) : '—'}</td>
											<td className="table-cell text-right">{r.taxes > 0 ? fmt$(r.taxes) : '—'}</td>
											<td className="table-cell text-right text-muted">{r.platform_fees > 0 ? `-${fmt$(r.platform_fees)}` : '—'}</td>
											<td className="table-cell text-right font-semibold text-green-600">{fmt$(r.revenue)}</td>
										</tr>
									);
								})}
								<tr className="border-t-2 border-brand-200 bg-gray-50 font-semibold">
									<td className="table-cell" colSpan={3}>Totals</td>
									<td className="table-cell text-right">{fmt$(data.reservations.reduce((s, r) => s + (r.accommodation_fare || 0), 0))}</td>
									<td className="table-cell text-right">{fmt$(data.reservations.reduce((s, r) => s + (r.cleaning_fee || 0), 0))}</td>
									<td className="table-cell text-right">{fmt$(data.reservations.reduce((s, r) => s + (r.pet_fee || 0), 0))}</td>
									<td className="table-cell text-right">{fmt$(data.reservations.reduce((s, r) => s + (r.fee_items || []).filter((f) => !/clean|pet/i.test(f.label)).reduce((a, f) => a + f.amount, 0), 0))}</td>
									<td className="table-cell text-right">{fmt$(data.reservations.reduce((s, r) => s + (r.taxes || 0), 0))}</td>
									<td className="table-cell text-right text-muted">{fmt$(data.reservations.reduce((s, r) => s + (r.platform_fees || 0), 0))}</td>
									<td className="table-cell text-right text-brand-600">{fmt$(summary?.total_revenue)}</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			)}

			{data.expenses?.length > 0 && (
				<div className="card p-5">
					<div className="flex items-center justify-between mb-4">
						<h2 className="font-semibold text-dark">Manual Expenses ({data.expenses.length})</h2>
						<button type="button" onClick={onAddExpense} className="btn-secondary text-xs gap-1">
							<Plus size={14} /> Add
						</button>
					</div>
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr className="border-b border-border">
									<th className="table-head">Date</th>
									<th className="table-head">Property</th>
									<th className="table-head">Category</th>
									<th className="table-head">Vendor</th>
									<th className="table-head">Notes</th>
									<th className="table-head text-right">Amount</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{data.expenses.map((e) => (
									<tr key={e.id} className="hover:bg-gray-50">
										<td className="table-cell">{e.date}</td>
										<td className="table-cell truncate max-w-xs">{e.property_name || e.property_id}</td>
										<td className="table-cell">{e.category}</td>
										<td className="table-cell text-muted">{e.vendor || '—'}</td>
										<td className="table-cell text-muted text-xs truncate max-w-xs">{e.notes || '—'}</td>
										<td className="table-cell text-right font-medium text-red-600">{fmt$(e.amount)}</td>
									</tr>
								))}
								<tr className="border-t-2 border-red-200 font-semibold">
									<td className="table-cell" colSpan={5}>Total Expenses</td>
									<td className="table-cell text-right text-red-600">{fmt$(summary?.total_expenses)}</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			)}
		</>
	);
}
