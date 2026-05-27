import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Filter, RefreshCw } from 'lucide-react';
import Layout from '../components/Layout';
import Badge from '../components/Badge';
import DateInput from '../components/DateInput';
import ReservationPanel, { reservationGuestName } from '../components/ReservationPanel';
import { PageLoader, ErrorState, EmptyState } from '../components/LoadingSpinner';
import { fetchJson } from '../lib/apiClient';
import { formatDateOrDash, parseIsoWallClockTime } from '../lib/dates';
import { formatClock } from '../lib/taskDisplay';
import { groupReservationsByTimeline, reservationCheckInDate, reservationCheckOutDate } from '../lib/reservationDates';
import { requireAuth } from '../lib/auth';

const PLATFORMS = ['', 'airbnb', 'homeaway', 'booking_com', 'direct'];
const STATUSES  = ['', 'accepted', 'cancelled', 'pending', 'inquiry'];

function fmt(dateStr) {
  return formatDateOrDash(dateStr);
}

function fmtTime(dateStr) {
  const time = parseIsoWallClockTime(dateStr);
  return time ? formatClock(time) : '';
}

export default function ReservationsPage() {
  const router = useRouter();
  const [reservations, setReservations] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    property: '', status: '', platform: '', start: '', end: '',
  });
  const [search, setSearch] = useState('');
  const [meta, setMeta] = useState(null);
  const [selected, setSelected] = useState(null);

  async function load() {
    setLoading(true); setError('');
    try {
      const propsJson = await fetchJson('/api/properties');
      if (!propsJson) return;
      const props = propsJson.data || [];
      setProperties(props);

      const params = new URLSearchParams();
      if (filters.property) params.set('property', filters.property);
      if (filters.status) params.set('status', filters.status);
      if (filters.platform) params.set('platform', filters.platform);
      if (filters.start) params.set('start', filters.start);
      if (filters.end) params.set('end', filters.end);

      const json = await fetchJson('/api/reservations?' + params);
      if (json) {
        setReservations(json.data || []);
        setMeta(json.meta || null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const code = router.query.code;
    if (!code || !reservations.length) return;
    const match = reservations.find(
      (r) => String(r.code).toLowerCase() === String(code).toLowerCase(),
    );
    if (match) setSelected(match);
  }, [router.query.code, reservations]);

  // Filter by search locally
  const filtered = useMemo(() => {
    if (!search.trim()) return reservations;
    const q = search.toLowerCase();
    return reservations.filter(
      (r) =>
        reservationGuestName(r).toLowerCase().includes(q) ||
        r.code?.toLowerCase().includes(q) ||
        r.property_name?.toLowerCase().includes(q) ||
        r.id?.toLowerCase().includes(q) ||
        r.platform?.toLowerCase().includes(q)
    );
  }, [reservations, search]);

  const { future, active, past, cancelled } = useMemo(
    () => groupReservationsByTimeline(filtered),
    [filtered],
  );

  const [tab, setTab] = useState('active');
  const displayed =
    tab === 'future' ? future
      : tab === 'active' ? active
        : tab === 'cancelled' ? cancelled
          : past;

  const tabLabels = {
    future: 'Future',
    active: 'Active',
    past: 'Past',
    cancelled: 'Cancelled',
  };

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
            <p className="text-muted text-sm mt-0.5">
              {filtered.length} loaded
              {meta?.date_from && meta?.date_to && !filters.start && !filters.end
                ? ` · check-in ${meta.date_from} to ${meta.date_to}`
                : ''}
              {' · '}
              {displayed.length} on {tabLabels[tab]} tab
            </p>
            <p className="text-muted text-xs mt-1">
              Switch tabs to see Future, Active, Past, and Cancelled reservations.
            </p>
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
              <DateInput value={filters.start} onChange={(e) => setFilters(f => ({ ...f, start: e.target.value }))} />
            </div>
            <div>
              <label className="label">Check-in to</label>
              <DateInput value={filters.end} onChange={(e) => setFilters(f => ({ ...f, end: e.target.value }))} />
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
        <div className="flex flex-wrap border-b border-border mb-4 gap-0">
          {[
            { key: 'future', label: `Future (${future.length})` },
            { key: 'active', label: `Active (${active.length})` },
            { key: 'past', label: `Past (${past.length})` },
            { key: 'cancelled', label: `Cancelled (${cancelled.length})` },
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
                        <th className="table-head">Reservation ID</th>
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
                            <p className="font-mono text-sm text-dark font-semibold tracking-wide">{r.code || '—'}</p>
                          </td>
                          <td className="table-cell">
                            <p className="font-medium text-dark">{reservationGuestName(r) || '—'}</p>
                          </td>
                          <td className="table-cell">
                            <p className="font-mono text-sm font-semibold text-dark tracking-wide">{r.property_name}</p>
                          </td>
                          <td className="table-cell">
                            <p>{fmt(reservationCheckInDate(r))}</p>
                            <p className="text-xs text-muted">{fmtTime(r.check_in || r.arrival_date)}</p>
                          </td>
                          <td className="table-cell">
                            <p>{fmt(reservationCheckOutDate(r))}</p>
                            <p className="text-xs text-muted">{fmtTime(r.check_out || r.departure_date)}</p>
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
