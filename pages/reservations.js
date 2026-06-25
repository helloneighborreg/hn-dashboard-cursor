import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import ReservationFiltersPanel from '../components/ReservationFiltersPanel';
import Badge from '../components/Badge';
import ReservationPanel, { reservationGuestName } from '../components/ReservationPanel';
import { PageLoader, ErrorState, EmptyState } from '../components/LoadingSpinner';
import { fetchJson } from '../lib/apiClient';
import { formatDateOrDash, parseIsoWallClockTime } from '../lib/dates';
import { formatClock } from '../lib/taskDisplay';
import { groupReservationsByTimeline, reservationCheckInDate, reservationCheckOutDate } from '../lib/reservationDates';
import { requireAuth } from '../lib/auth';

const VALID_TABS = new Set(['future', 'active']);
const CANCELLED_STATUSES = new Set(['cancelled', 'expired', 'declined']);

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

function ReservationMobileCard({ reservation, onSelect }) {
  const checkInTime = fmtTime(reservation.check_in || reservation.arrival_date);
  const checkOutTime = fmtTime(reservation.check_out || reservation.departure_date);

  return (
    <button
      type="button"
      onClick={() => onSelect(reservation)}
      className="w-full rounded-xl border border-border bg-white p-4 text-left shadow-card transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold tracking-wide text-muted">
            {reservation.code || 'Reservation'}
          </p>
          <p className="mt-1 truncate text-base font-semibold text-dark">
            {reservationGuestName(reservation) || 'Guest'}
          </p>
          <p className="mt-0.5 truncate text-sm text-muted">{reservation.property_name || '—'}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge label={reservation.status} variant={reservation.status} />
          <Badge label={reservation.platform_label || reservation.platform} variant={reservation.platform} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Check-in</p>
          <p className="font-medium text-dark">{fmt(reservationCheckInDate(reservation))}</p>
          {checkInTime && <p className="text-xs text-muted">{checkInTime}</p>}
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Check-out</p>
          <p className="font-medium text-dark">{fmt(reservationCheckOutDate(reservation))}</p>
          {checkOutTime && <p className="text-xs text-muted">{checkOutTime}</p>}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
        <span className="rounded-full bg-gray-100 px-2 py-0.5">{reservation.nights ?? '—'} nights</span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5">{reservation.guests?.total ?? '—'} guests</span>
      </div>
    </button>
  );
}

export default function ReservationsPage() {
  const router = useRouter();
  const [reservations, setReservations] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(() => filtersFromQuery(router.query));
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

  const { future, active, past, cancelled } = useMemo(
    () => groupReservationsByTimeline(reservations),
    [reservations],
  );

  const filteredView = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (CANCELLED_STATUSES.has(filters.status)) return 'cancelled';
    if (filters.end && filters.end < today) return 'historical';
    return null;
  }, [filters.status, filters.end]);

  const displayed = useMemo(() => {
    if (filteredView === 'cancelled') return cancelled;
    if (filteredView === 'historical') {
      return [...past, ...cancelled].sort((a, b) =>
        (reservationCheckOutDate(b) || reservationCheckInDate(b) || '')
          .localeCompare(reservationCheckOutDate(a) || reservationCheckInDate(a) || ''),
      );
    }
    return tab === 'future' ? future : active;
  }, [filteredView, tab, future, active, past, cancelled]);

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

        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-dark">Reservations</h1>
        </div>

        <ReservationFiltersPanel
          filters={filters}
          setFilters={setFilters}
          properties={properties}
          onApply={applyFilters}
        />

        {!filteredView && (
          <div className="flex flex-wrap border-b border-border mb-4 gap-0">
            {[
              { key: 'future', label: `Future (${future.length})` },
              { key: 'active', label: `Active (${active.length})` },
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
        )}

        {loading && <PageLoader message="Loading reservations…" />}
        {error && <ErrorState message={error} retry={load} />}

        {!loading && !error && (
          displayed.length === 0
            ? <EmptyState title="No reservations" message="No reservations match your current filters" />
            : (
              <>
                <div className="space-y-3 lg:hidden">
                  {displayed.map((r) => (
                    <ReservationMobileCard
                      key={r.id}
                      reservation={r}
                      onSelect={setSelected}
                    />
                  ))}
                </div>

                <div className="card hidden overflow-hidden lg:block">
                  <div className="table-scroll">
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
              </>
            )
        )}
      </Layout>
    </>
  );
}

export const getServerSideProps = requireAuth(async () => ({ props: {} }));
