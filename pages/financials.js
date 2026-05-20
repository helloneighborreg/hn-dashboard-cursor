import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { RefreshCw, Filter, Plus, DollarSign, TrendingUp, Home, BarChart3 } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { format } from 'date-fns';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import { PageLoader, ErrorState } from '../components/LoadingSpinner';
import ExpenseModal from '../components/ExpenseModal';
import { requireAuth } from '../lib/auth';

const CHART_COLORS = ['#5B9AB8', '#3E7F9A', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

function fmt$(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtPct(n) { return `${(n ?? 0).toFixed(1)}%`; }

export default function FinancialsPage() {
  const [data, setData] = useState(null);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [filters, setFilters] = useState({
    property: '',
    date_from: new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10),
    date_to: new Date().toISOString().slice(0, 10),
  });

  async function load() {
    setLoading(true); setError('');
    try {
      const propsRes = await fetch('/api/properties');
      if (propsRes.status === 401) { window.location.href = '/'; return; }
      const propsJson = await propsRes.json();
      setProperties(propsJson.data || []);

      const params = new URLSearchParams();
      if (filters.property) params.set('property', filters.property);
      if (filters.date_from) params.set('date_from', filters.date_from);
      if (filters.date_to) params.set('date_to', filters.date_to);

      const res = await fetch('/api/financials?' + params);
      if (!res.ok) throw new Error((await res.json()).error);
      const json = await res.json();
      setData(json.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const s = data?.summary;

  return (
    <>
      <Head><title>Financials — Hello Neighbor</title></Head>
      <Layout title="">
        {showExpenseModal && (
          <ExpenseModal
            properties={properties}
            title="Add Manual Expense"
            onClose={() => setShowExpenseModal(false)}
            onSaved={load}
          />
        )}

        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-dark">Financials</h1>
            <p className="text-muted text-sm mt-0.5">Revenue, expenses & performance</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => setShowExpenseModal(true)} className="btn-primary gap-1.5 text-sm">
              <Plus size={16} /> Add Expense
            </button>
            <button onClick={load} className="btn-secondary text-xs gap-1.5">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="card p-4 mb-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="label">Property</label>
              <select className="select" value={filters.property} onChange={(e) => setFilters(f => ({ ...f, property: e.target.value }))}>
                <option value="">All properties</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date from</label>
              <input type="date" className="input" value={filters.date_from} onChange={(e) => setFilters(f => ({ ...f, date_from: e.target.value }))} />
            </div>
            <div>
              <label className="label">Date to</label>
              <input type="date" className="input" value={filters.date_to} onChange={(e) => setFilters(f => ({ ...f, date_to: e.target.value }))} />
            </div>
            <button onClick={load} className="btn-primary justify-center gap-1.5">
              <Filter size={14} /> Apply
            </button>
          </div>

          {/* Quick date ranges */}
          <div className="flex flex-wrap gap-2 mt-3">
            {[
              { label: 'This month', from: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'), to: new Date().toISOString().slice(0, 10) },
              { label: 'Last month', from: format(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1), 'yyyy-MM-dd'), to: format(new Date(new Date().getFullYear(), new Date().getMonth(), 0), 'yyyy-MM-dd') },
              { label: 'This year', from: `${new Date().getFullYear()}-01-01`, to: new Date().toISOString().slice(0, 10) },
              { label: 'Last 90 days', from: format(new Date(Date.now() - 90 * 86400000), 'yyyy-MM-dd'), to: new Date().toISOString().slice(0, 10) },
            ].map(({ label, from, to }) => (
              <button
                key={label}
                onClick={() => { setFilters(f => ({ ...f, date_from: from, date_to: to })); }}
                className="text-xs px-3 py-1 rounded-full border border-border hover:border-brand-400 hover:text-brand-600 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading && <PageLoader message="Loading financial data…" />}
        {error && <ErrorState message={error} retry={load} />}

        {data && !loading && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard label="Total Revenue" value={fmt$(s?.total_revenue)} sub={`${s?.total_reservations} reservations`} icon={DollarSign} color="green" />
              <StatCard label="Total Expenses" value={fmt$(s?.total_expenses)} sub="manual entries" icon={TrendingUp} color="red" />
              <StatCard label="Net Income" value={fmt$(s?.net_income)} sub="revenue minus expenses" icon={TrendingUp} color={s?.net_income >= 0 ? 'brand' : 'red'} />
              <StatCard label="Properties" value={s?.properties_count} sub={`${s?.total_nights} total nights`} icon={Home} color="brand" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard label="Occupancy Rate" value={fmtPct(s?.occupancy_rate)} sub="of available days" icon={BarChart3} color="brand" />
              <StatCard label="ADR" value={fmt$(s?.adr)} sub="avg daily rate" icon={DollarSign} color="green" />
              <StatCard label="RevPAR" value={fmt$(s?.revpar)} sub="revenue per avail room" icon={TrendingUp} color="brand" />
              <StatCard label="Total Nights" value={s?.total_nights} sub="booked nights" icon={Home} color="amber" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Monthly revenue chart */}
              <div className="card p-5">
                <h2 className="font-semibold text-dark mb-4">Monthly Revenue & Expenses</h2>
                {data.monthly_chart?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.monthly_chart} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
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

              {/* By property */}
              <div className="card p-5">
                <h2 className="font-semibold text-dark mb-4">Revenue by Property</h2>
                {data.by_property?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.by_property} layout="vertical" margin={{ top: 5, right: 5, left: 80, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
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
              {/* By platform */}
              <div className="card p-5">
                <h2 className="font-semibold text-dark mb-4">Revenue by Platform</h2>
                {data.by_platform?.length > 0 ? (
                  <div>
                    <div className="flex justify-center mb-4">
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie data={data.by_platform} dataKey="revenue" nameKey="label" cx="50%" cy="50%" outerRadius={70} label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                            {data.by_platform.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v) => fmt$(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-1">
                      {data.by_platform.map((p, i) => (
                        <div key={p.platform} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
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

              {/* Expense breakdown */}
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
                    <button onClick={() => setShowExpenseModal(true)} className="btn-primary mt-3 text-sm">Add Expense</button>
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

            {/* Reservation table */}
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
                        <td className="table-cell text-right text-brand-600">{fmt$(s?.total_revenue)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Transaction Log — per-reservation revenue breakdown */}
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
                        <td className="table-cell text-right text-brand-600">{fmt$(s?.total_revenue)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Expenses table */}
            {data.expenses?.length > 0 && (
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-dark">Manual Expenses ({data.expenses.length})</h2>
                  <button onClick={() => setShowExpenseModal(true)} className="btn-secondary text-xs gap-1"><Plus size={14} /> Add</button>
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
                        <td className="table-cell text-right text-red-600">{fmt$(s?.total_expenses)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </Layout>
    </>
  );
}

export const getServerSideProps = requireAuth(async () => ({ props: {} }));
