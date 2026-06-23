import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import PageActionButtons from '../components/PageActionButtons';
import PageSearchInput from '../components/PageSearchInput';
import ReservationFiltersPanel from '../components/ReservationFiltersPanel';
import Badge from '../components/Badge';
import ReservationPanel, { reservationGuestName } from '../components/ReservationPanel';
import { PageLoader, ErrorState, EmptyState } from '../components/LoadingSpinner';
import { fetchJson } from '../lib/apiClient';
import { formatDateOrDash, parseIsoWallClockTime } from '../lib/dates';
import { formatClock } from '../lib/taskDisplay';
import { groupReservationsByTimeline, reservationCheckInDate, reservationCheckOutDate } from '../lib/reservationDates';
import { requireAuth } from '../lib/auth';

const VALID_TABS = new Set(['future', 'active', 'past', 'cancelled']);

function filtersFromQuery(query = {}) {
  return {
    property: typeof query.property === 'string' ? query.property : '',
    status: typeof query.status === 'string' ? query.status : '',
    platform: typeof query.platform === 'string' ? query.platform : '',
    start: typeof query.start === 'string' ? query.start : '',
    end: typeof query.end === 'string' ? query.end : '',
  };
}

function tabFromQuery(query = {}) {
  const tab = typeof query.tab === 'string' ? query.tab : '';
  return VALID_TABS.has(tab) ? tab : 'active';
}

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
  const [filters, setFilters] = useState(() => filtersFromQuery(router.query));
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState(() => tabFromQuery(router.query));
  const [initializedFromQuery, setInitializedFromQuery] = useState(false);

  async function load(overrides = {}) {
    setLoading(true); setError('');
    try {
      const propsJson = await fetchJson('/api/properties');
      if (!propsJson) return;
      const props = propsJson.data || [];
      setProperties(props);

      const active = { ...filters, ...overrides };
      const params = new URLSearchParams();
      if (active.property) params.set('property', active.property);
      if (active.status) params.set('status', active.status);
      if (active.platform) params.set('platform', active.platform);
      if (active.start) params.set('start', active.start);
      if (active.end) params.set('end', active.end);

      const json = await fetchJson('/api/reservations?' + params);
      if (json) {
        setReservations(json.data || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!router.isReady || initializedFromQuery) return;
    const nextFilters = filtersFromQuery(router.query);
    const nextTab = tabFromQuery(router.query);
    setFilters(nextFilters);
    setTab(nextTab);
    setInitializedFromQuery(true);
    load(nextFilters);
  }, [router.isReady, router.query, initializedFromQuery]);

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

  const displayed =
    tab === 'future' ? future
      : tab === 'active' ? active
        : tab === 'cancelled' ? cancelled
          : past;

  function applyFilters() { load(); }

  function selectTab(nextTab) {
    setTab(nextTab);
    const query = { ...router.query, tab: nextTab };
    if (!filters.start) delete query.start;
    else query.start = filters.start;
    if (!filters.end) delete query.end;
    else query.end = filters.end;
    router.replace({ pathname: router.pathname, query }, undefined, { shallow: true });
  }

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

        <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-dark">Reservations</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-end w-full lg:w-auto">
            <PageSearchInput
              placeholder="Search code, property…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <PageActionButtons onRefresh={load} refreshing={loading} />
          </div>
        </div>

        <ReservationFiltersPanel
          filters={filters}
          setFilters={setFilters}
          properties={properties}
          onApply={applyFilters}
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
              onClick={() => selectTab(key)}
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
                        <th className="table-head-date">Check-in</th>
                        <th className="table-head-date">Check-out</th>
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
                            <p className="text-sm font-semibold text-dark">{r.property_name}</p>
                          </td>
                          <td className="table-cell-date">
                            <p>{fmt(reservationCheckInDate(r))}</p>
                            <p className="text-[10px] text-muted">{fmtTime(r.check_in || r.arrival_date)}</p>
                          </td>
                          <td className="table-cell-date">
                            <p>{fmt(reservationCheckOutDate(r))}</p>
                            <p className="text-[10px] text-muted">{fmtTime(r.check_out || r.departure_date)}</p>
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
