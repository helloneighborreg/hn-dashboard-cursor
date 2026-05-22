import { useState, useEffect } from 'react';
import Head from 'next/head';
import { RefreshCw, Filter, Plus, DollarSign, TrendingUp, Home, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import { PageLoader, ErrorState } from '../components/LoadingSpinner';
import ExpenseModal from '../components/ExpenseModal';
import FinancialsCharts from '../components/financials/FinancialsCharts';
import FinancialsTables from '../components/financials/FinancialsTables';
import { fmt$ } from '../components/financials/format';
import { fetchJson } from '../lib/apiClient';
import { requireAuth } from '../lib/auth';

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

  useEffect(() => {
    fetchJson('/api/properties')
      .then((json) => { if (json) setProperties(json.data || []); })
      .catch(() => setProperties([]));
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filters.property) params.set('property', filters.property);
      if (filters.date_from) params.set('date_from', filters.date_from);
      if (filters.date_to) params.set('date_to', filters.date_to);

      const json = await fetchJson('/api/financials?' + params);
      if (json) setData(json.data);
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
            <button type="button" onClick={() => setShowExpenseModal(true)} className="btn-primary gap-1.5 text-sm">
              <Plus size={16} /> Add Expense
            </button>
            <button type="button" onClick={load} className="btn-secondary text-xs gap-1.5">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        <div className="card p-4 mb-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="label">Property</label>
              <select className="select" value={filters.property} onChange={(e) => setFilters((f) => ({ ...f, property: e.target.value }))}>
                <option value="">All properties</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date from</label>
              <input type="date" className="input" value={filters.date_from} onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))} />
            </div>
            <div>
              <label className="label">Date to</label>
              <input type="date" className="input" value={filters.date_to} onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))} />
            </div>
            <button type="button" onClick={load} className="btn-primary justify-center gap-1.5">
              <Filter size={14} /> Apply
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            {[
              { label: 'This month', from: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'), to: new Date().toISOString().slice(0, 10) },
              { label: 'Last month', from: format(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1), 'yyyy-MM-dd'), to: format(new Date(new Date().getFullYear(), new Date().getMonth(), 0), 'yyyy-MM-dd') },
              { label: 'This year', from: `${new Date().getFullYear()}-01-01`, to: new Date().toISOString().slice(0, 10) },
              { label: 'Last 90 days', from: format(new Date(Date.now() - 90 * 86400000), 'yyyy-MM-dd'), to: new Date().toISOString().slice(0, 10) },
            ].map(({ label, from, to }) => (
              <button
                key={label}
                type="button"
                onClick={() => { setFilters((f) => ({ ...f, date_from: from, date_to: to })); }}
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard label="Total Revenue" value={fmt$(s?.total_revenue)} sub={`${s?.total_reservations} reservations`} icon={DollarSign} color="green" />
              <StatCard label="Total Expenses" value={fmt$(s?.total_expenses)} sub="manual entries" icon={TrendingUp} color="red" />
              <StatCard label="Net Income" value={fmt$(s?.net_income)} sub="revenue minus expenses" icon={TrendingUp} color={s?.net_income >= 0 ? 'brand' : 'red'} />
              <StatCard label="Properties" value={s?.properties_count} sub={`${s?.total_nights} total nights`} icon={Home} color="brand" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard label="Occupancy Rate" value={`${(s?.occupancy_rate ?? 0).toFixed(1)}%`} sub="of available days" icon={BarChart3} color="brand" />
              <StatCard label="ADR" value={fmt$(s?.adr)} sub="avg daily rate" icon={DollarSign} color="green" />
              <StatCard label="RevPAR" value={fmt$(s?.revpar)} sub="revenue per avail room" icon={TrendingUp} color="brand" />
              <StatCard label="Total Nights" value={s?.total_nights} sub="booked nights" icon={Home} color="amber" />
            </div>

            <FinancialsCharts
              data={data}
              summary={s}
              onAddExpense={() => setShowExpenseModal(true)}
            />
            <FinancialsTables
              data={data}
              summary={s}
              onAddExpense={() => setShowExpenseModal(true)}
            />
          </>
        )}
      </Layout>
    </>
  );
}

export const getServerSideProps = requireAuth(async () => ({ props: {} }));
