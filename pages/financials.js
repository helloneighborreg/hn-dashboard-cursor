import { useState, useEffect } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { DollarSign, TrendingUp, Home, BarChart3 } from 'lucide-react';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import { PageLoader, ErrorState } from '../components/LoadingSpinner';
import FinancialsFilters from '../components/financials/FinancialsFilters';
import FinancialsTables from '../components/financials/FinancialsTables';

const FinancialsCharts = dynamic(
  () => import('../components/financials/FinancialsCharts'),
  { ssr: false, loading: () => <PageLoader message="Loading charts…" /> },
);
import { fmt$ } from '../components/financials/format';
import { fetchJson } from '../lib/apiClient';
import { requireAuth } from '../lib/auth';
import { startOfYearIso, todayIso } from '../lib/dates';

export default function FinancialsPage() {
  const [data, setData] = useState(null);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    property: '',
    date_from: startOfYearIso(),
    date_to: todayIso(),
  });

  useEffect(() => {
    fetchJson('/api/properties')
      .then((json) => { if (json) setProperties(json.data || []); })
      .catch(() => setProperties([]));
  }, []);

  async function load(overrides = {}) {
    const active = { ...filters, ...overrides };
    if (overrides.property !== undefined || overrides.date_from !== undefined || overrides.date_to !== undefined) {
      setFilters(active);
    }
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (active.property) params.set('property', active.property);
      if (active.date_from) params.set('date_from', active.date_from);
      if (active.date_to) params.set('date_to', active.date_to);

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
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-dark">Financials</h1>
            <p className="text-muted text-sm mt-0.5">Revenue, expenses & performance</p>
          </div>
        </div>

        <FinancialsFilters
          filters={filters}
          properties={properties}
          onChange={setFilters}
          onApply={load}
        />

        {loading && <PageLoader message="Loading financial data…" />}
        {error && <ErrorState message={error} retry={load} />}

        {data && !loading && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard label="Total Revenue" value={fmt$(s?.total_revenue)} sub={`${s?.total_reservations} reservations`} icon={DollarSign} color="green" />
              <StatCard label="Total Expenses" value={fmt$(s?.total_expenses)} sub="manual entries" icon={TrendingUp} color="red" />
              <StatCard label="Net Income" value={fmt$(s?.net_income)} sub="revenue minus expenses" icon={TrendingUp} color={s?.net_income >= 0 ? 'brand' : 'red'} />
              <StatCard label="Properties" value={s?.properties_count} sub={`${s?.total_nights} total nights`} icon={Home} color="brand" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard label="Occupancy Rate" value={`${(s?.occupancy_rate ?? 0).toFixed(1)}%`} sub="of available days" icon={BarChart3} color="brand" />
              <StatCard label="ADR" value={fmt$(s?.adr)} sub="avg daily rate" icon={DollarSign} color="green" />
              <StatCard label="RevPAR" value={fmt$(s?.revpar)} sub="revenue per avail room" icon={TrendingUp} color="brand" />
              <StatCard label="Total Nights" value={s?.total_nights} sub="booked nights" icon={Home} color="amber" />
            </div>

            <FinancialsCharts
              data={data}
              summary={s}
            />
            <FinancialsTables data={data} />
          </>
        )}
      </Layout>
    </>
  );
}

export const getServerSideProps = requireAuth(async () => ({ props: {} }));
