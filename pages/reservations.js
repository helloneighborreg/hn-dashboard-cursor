import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Filter, RefreshCw, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import Layout from '../components/Layout';
import Badge from '../components/Badge';
import ReservationPanel, { reservationGuestName } from '../components/ReservationPanel';
import { PageLoader, ErrorState, EmptyState } from '../components/LoadingSpinner';
import { requireAuth } from '../lib/auth';

const PLATFORMS = ['', 'airbnb', 'homeaway', 'booking_com', 'direct'];
const STATUSES  = ['', 'accepted', 'cancelled', 'pending', 'inquiry'];

function fmt(dateStr) {
  if (!dateStr) return '—';
  try { return format(new Date(dateStr), 'MMM d, yyyy'); } catch { return dateStr; }
}

function fmtTime(dateStr) {
  if (!dateStr) return '';
  try { return format(new Date(dateStr), 'h:mm a'); } catch { return ''; }
}

export default function ReservationsPage() {
  const [reservations, setReservations] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    property: '', status: '', platform: '', start: '', end: '',
  });
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  async function load() {
    setLoading(true); setError('');
    try {
      const [propsRes] = await Promise.all([fetch('/api/properties')]);
      if (propsRes.status === 401) { window.location.href = '/'; return; }
      const propsJson = await propsRes.json();
      const props = propsJson.data || [];
      setProperties(props);

      const params = new URLSearchParams();
      if (filters.property) params.set('property', filters.property);
      if (filters.status) params.set('status', filters.status);
      if (filters.platform) params.set('platform', filters.platform);
      if (filters.start) params.set('start', filters.start);
      if (filters.end) params.set('end', filters.end);
      params.set('per_page', '200');

      const res = await fetch('/api/reservations?' + params);
      if (!res.ok) throw new Error((await res.json()).error);
      const json = await res.json();
      setReservations(json.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Filter by search locally
  const filtered = useMemo(() => {
    if (!search.trim()) return reservations;
    const q = search.toLowerCase();
    return reservations.filter(
      (r) =>
        reservationGuestName(r).toLowerCase().includes(q) ||
        r.code?.toLowerCase().includes(q) ||
        r.property_name?.toLowerCase().includes(q) ||
        r.platform?.toLowerCase().includes(q)
    );
  }, [reservations, search]);

  // Categorize
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = filtered.filter((r) => {
    const ci = (r.check_in || r.arrival_date)?.slice(0, 10);
    return ci >= today && r.status !== 'cancelled';
  });
  const current = filtered.filter((r) => {
    const ci = (r.check_in || r.arrival_date)?.slice(0, 10);
    const co = (r.check_out || r.departure_date)?.slice(0, 10);
    return ci <= today && co >= today && r.status !== 'cancelled';
  });
  const past = filtered.filter((r) => {
    const co = (r.check_out || r.departure_date)?.slice(0, 10);
    return co < today;
  });

  const [tab, setTab] = useState('upcoming');
  const displayed = tab === 'upcoming' ? upcoming : tab === 'current' ? current : past;

  function applyFilters() { load(); }

  return (
    <>
      <Head><title>Reservations — Hello Neighbor</title></Head>
      <Layout title="">
        {selected && (
          <ReservationPanel
            resv={selected}
            propName={selected.property_name}
            onClose={() => setSelected(null)}
          />
        )}

        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-dark">Reservations</h1>
            <p className="text-muted text-sm mt-0.5">{filtered.length} total</p>
          </div>
          <button onClick={load} className="btn-secondary text-xs gap-1.5 flex-shrink-0">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="card p-4 mb-5">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="label">Property</label>
              <select className="select" value={filters.property} onChange={(e) => setFilters(f => ({ ...f, property: e.target.value }))}>
                <option value="">All properties</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="select" value={filters.status} onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}>
                <option value="">All statuses</option>
                {STATUSES.slice(1).map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Platform</label>
              <select className="select" value={filters.platform} onChange={(e) => setFilters(f => ({ ...f, platform: e.target.value }))}>
                <option value="">All platforms</option>
                <option value="airbnb">Airbnb</option>
                <option value="homeaway">VRBO</option>
                <option value="booking_com">Booking.com</option>
                <option value="direct">Direct</option>
              </select>
            </div>
            <div>
              <label className="label">Check-in from</label>
              <input type="date" className="input" value={filters.start} onChange={(e) => setFilters(f => ({ ...f, start: e.target.value }))} />
            </div>
            <div>
              <label className="label">Check-in to</label>
              <input type="date" className="input" value={filters.end} onChange={(e) => setFilters(f => ({ ...f, end: e.target.value }))} />
            </div>
            <div className="flex items-end">
              <button onClick={applyFilters} className="btn-primary w-full justify-center gap-1.5">
                <Filter size={14} /> Apply
              </button>
            </div>
          </div>
        </div>

        {/* Search */}
        <input
          className="input mb-4"
          placeholder="Search by code, property, or platform…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Tabs */}
        <div className="flex border-b border-border mb-4 gap-0">
          {[
            { key: 'upcoming', label: `Upcoming (${upcoming.length})` },
            { key: 'current',  label: `Active (${current.length})` },
            { key: 'past',     label: `Past (${past.length})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === key ? 'border-brand-500 text-brand-600' : 'border-transparent text-muted hover:text-dark'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading && <PageLoader message="Loading reservations…" />}
        {error && <ErrorState message={error} retry={load} />}

        {!loading && !error && (
          displayed.length === 0
            ? <EmptyState title="No reservations" message="No reservations match your current filters" />
            : (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-border">
                      <tr>
                        <th className="table-head">Guest</th>
                        <th className="table-head">Property</th>
                        <th className="table-head">Check-in</th>
                        <th className="table-head">Check-out</th>
                        <th className="table-head">Nights</th>
                        <th className="table-head">Guests</th>
                        <th className="table-head">Platform</th>
                        <th className="table-head">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {displayed.map((r) => (
                        <tr
                          key={r.id}
                          onClick={() => setSelected(r)}
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <td className="table-cell">
                            <div>
                              <p className="font-medium text-dark">{reservationGuestName(r) || '—'}</p>
                              <p className="text-xs text-muted font-mono">{r.code}</p>
                            </div>
                          </td>
                          <td className="table-cell">
                            <p className="font-medium text-dark truncate max-w-xs">{r.property_name}</p>
                          </td>
                          <td className="table-cell">
                            <p>{fmt(r.check_in || r.arrival_date)}</p>
                            <p className="text-xs text-muted">{fmtTime(r.check_in)}</p>
                          </td>
                          <td className="table-cell">
                            <p>{fmt(r.check_out || r.departure_date)}</p>
                            <p className="text-xs text-muted">{fmtTime(r.check_out)}</p>
                          </td>
                          <td className="table-cell">{r.nights}</td>
                          <td className="table-cell">{r.guests?.total ?? '–'}</td>
                          <td className="table-cell">
                            <Badge label={r.platform_label || r.platform} variant={r.platform} />
                          </td>
                          <td className="table-cell">
                            <Badge label={r.status} variant={r.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
        )}
      </Layout>
    </>
  );
}

export const getServerSideProps = requireAuth(async () => ({ props: {} }));
