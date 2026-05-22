import {
	BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
	Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { CHART_COLORS, fmt$, fmtPct } from './format';

export default function FinancialsCharts({ data, summary, onAddExpense }) {
	return (
		<>
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
				<div className="card p-5">
					<h2 className="font-semibold text-dark mb-4">Monthly Revenue & Expenses</h2>
					{data.monthly_chart?.length > 0 ? (
						<ResponsiveContainer width="100%" height={220}>
							<BarChart data={data.monthly_chart} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
								<CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
								<XAxis dataKey="month" tick={{ fontSize: 11 }} />
								<YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
								<Tooltip formatter={(v) => fmt$(v)} />
								<Legend wrapperStyle={{ fontSize: '12px' }} />
								<Bar dataKey="revenue" fill="#5B9AB8" name="Revenue" radius={[4, 4, 0, 0]} />
								<Bar dataKey="expenses" fill="#EF4444" name="Expenses" radius={[4, 4, 0, 0]} />
								<Bar dataKey="net_income" fill="#10B981" name="Net Income" radius={[4, 4, 0, 0]} />
							</BarChart>
						</ResponsiveContainer>
					) : (
						<p className="text-muted text-sm text-center py-10">No data for selected period</p>
					)}
				</div>

				<div className="card p-5">
					<h2 className="font-semibold text-dark mb-4">Revenue by Property</h2>
					{data.by_property?.length > 0 ? (
						<ResponsiveContainer width="100%" height={220}>
							<BarChart data={data.by_property} layout="vertical" margin={{ top: 5, right: 5, left: 80, bottom: 5 }}>
								<CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
								<XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
								<YAxis dataKey="property_name" type="category" tick={{ fontSize: 10 }} width={80} />
								<Tooltip formatter={(v) => fmt$(v)} />
								<Bar dataKey="revenue" fill="#5B9AB8" name="Revenue" radius={[0, 4, 4, 0]} />
							</BarChart>
						</ResponsiveContainer>
					) : (
						<p className="text-muted text-sm text-center py-10">No data available</p>
					)}
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
				<div className="card p-5">
					<h2 className="font-semibold text-dark mb-4">Revenue by Platform</h2>
					{data.by_platform?.length > 0 ? (
						<div>
							<div className="flex justify-center mb-4">
								<ResponsiveContainer width="100%" height={180}>
									<PieChart>
										<Pie
											data={data.by_platform}
											dataKey="revenue"
											nameKey="label"
											cx="50%"
											cy="50%"
											outerRadius={70}
											label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
											labelLine={false}
										>
											{data.by_platform.map((_, i) => (
												<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
											))}
										</Pie>
										<Tooltip formatter={(v) => fmt$(v)} />
									</PieChart>
								</ResponsiveContainer>
							</div>
							<div className="space-y-1">
								{data.by_platform.map((p, i) => (
									<div key={p.platform} className="flex items-center justify-between text-sm">
										<div className="flex items-center gap-2">
											<div
												className="w-3 h-3 rounded-full flex-shrink-0"
												style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
											/>
											<span>{p.label}</span>
										</div>
										<div className="flex gap-4 text-right">
											<span className="text-muted">{p.reservations} res.</span>
											<span className="font-medium">{fmt$(p.revenue)}</span>
										</div>
									</div>
								))}
							</div>
						</div>
					) : (
						<p className="text-muted text-sm text-center py-10">No data available</p>
					)}
				</div>

				<div className="card p-5">
					<h2 className="font-semibold text-dark mb-4">Expense Breakdown</h2>
					{Object.keys(data.expense_by_category || {}).length > 0 ? (
						<div className="space-y-3">
							{Object.entries(data.expense_by_category)
								.sort(([, a], [, b]) => b - a)
								.map(([cat, amt], i) => {
									const total = Object.values(data.expense_by_category).reduce((s, v) => s + v, 0);
									const pct = total > 0 ? (amt / total) * 100 : 0;
									return (
										<div key={cat}>
											<div className="flex justify-between text-sm mb-1">
												<span className="text-dark">{cat}</span>
												<span className="font-medium">{fmt$(amt)}</span>
											</div>
											<div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
												<div
													className="h-full rounded-full"
													style={{ width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }}
												/>
											</div>
										</div>
									);
								})}
						</div>
					) : (
						<div className="text-center py-10">
							<p className="text-muted text-sm">No expenses recorded</p>
							<button type="button" onClick={onAddExpense} className="btn-primary mt-3 text-sm">
								Add Expense
							</button>
						</div>
					)}
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
				<div className="card p-5">
					<h2 className="font-semibold text-dark mb-4">Monthly Performance Trends</h2>
					{data.monthly_chart?.length > 0 ? (
						<ResponsiveContainer width="100%" height={240}>
							<LineChart data={data.monthly_chart} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
								<CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
								<XAxis dataKey="month" tick={{ fontSize: 11 }} />
								<YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
								<YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
								<Tooltip
									formatter={(value, name) => {
										if (name === 'Occupancy') return `${Number(value).toFixed(1)}%`;
										return fmt$(value);
									}}
								/>
								<Legend wrapperStyle={{ fontSize: '12px' }} />
								<Line yAxisId="left" type="monotone" dataKey="adr" stroke="#5B9AB8" strokeWidth={2} name="ADR" dot={false} />
								<Line yAxisId="left" type="monotone" dataKey="revpar" stroke="#10B981" strokeWidth={2} name="RevPAR" dot={false} />
								<Line yAxisId="right" type="monotone" dataKey="occupancy_rate" stroke="#F59E0B" strokeWidth={2} name="Occupancy" dot={false} />
							</LineChart>
						</ResponsiveContainer>
					) : (
						<p className="text-muted text-sm text-center py-10">No trend data available</p>
					)}
				</div>

				<div className="card p-5">
					<h2 className="font-semibold text-dark mb-4">Top Properties by Net Income</h2>
					{data.property_profitability?.length > 0 ? (
						<div className="space-y-3">
							{data.property_profitability.slice(0, 5).map((p, i) => (
								<div key={p.property_id} className="flex items-center justify-between border-b border-border pb-2">
									<div>
										<p className="text-sm font-medium text-dark">{i + 1}. {p.property_name}</p>
										<p className="text-xs text-muted">{p.reservations} reservations · {p.nights} nights</p>
									</div>
									<div className="text-right">
										<p className={`text-sm font-semibold ${p.net_income >= 0 ? 'text-green-600' : 'text-red-600'}`}>
											{fmt$(p.net_income)}
										</p>
										<p className="text-xs text-muted">margin {fmtPct(p.margin_pct || 0)}</p>
									</div>
								</div>
							))}
						</div>
					) : (
						<p className="text-muted text-sm text-center py-10">No property data available</p>
					)}
				</div>
			</div>
		</>
	);
}
