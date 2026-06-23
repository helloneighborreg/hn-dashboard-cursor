import { useState, useEffect } from 'react';
import Head from 'next/head';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  format, addDays, subDays, isToday, parseISO, differenceInDays,
} from 'date-fns';
import Layout from '../components/Layout';
import PageActionButtons from '../components/PageActionButtons';
import ReservationPanel, { reservationGuestName } from '../components/ReservationPanel';
import { fetchJson } from '../lib/apiClient';
import { formatDateRange } from '../lib/dates';
import { platformStyle } from '../lib/platformStyles';
import { getPropertyDisplayName } from '../lib/codes';
import { requireAuth } from '../lib/auth';

const COL_W    = 42;
const ROW_H    = 48;
const NAME_W   = 180;
const NUM_DAYS = 28;

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return addDays(d, -7);
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null); // { resv, propName }

  const days    = Array.from({ length: NUM_DAYS }, (_, i) => addDays(startDate, i));
  const endDate = days[days.length - 1];
  const startStr = format(startDate, 'yyyy-MM-dd');
  const endStr   = format(endDate, 'yyyy-MM-dd');

  async function load() {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ start: startStr, end: endStr });
      const json = await fetchJson('/api/calendar?' + params);
      if (json) setData(json.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [startStr]);

  function prev()   { setStartDate((d) => subDays(d, 7)); }
  function next()   { setStartDate((d) => addDays(d, 7)); }
  function goToday() {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    setStartDate(addDays(d, -7));
  }

  // Build a quick property lookup
  const propMap = Object.fromEntries((data?.properties || []).map((p) => [p.id, p]));

  // availability[propId][dateStr] = { available, reason }
  const availability = data?.availability || {};

  return (
    <>
      <Head><title>Calendar — Hello Neighbor</title></Head>
      <Layout title="">

        {/* Reservation detail panel */}
        {selected && (
          <ReservationPanel
            resv={selected.resv}
            propName={selected.propName}
            onClose={() => setSelected(null)}
          />
        )}

        {/* Page header */}
        <div className="flex flex-col gap-4 mb-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-dark">Calendar</h1>
            <p className="text-muted text-sm mt-0.5">Reservation timeline across all properties</p>
          </div>
          <div className="flex flex-col gap-3 w-full lg:w-auto lg:items-end">
            <PageActionButtons onRefresh={load} refreshing={loading} />
            <div className="flex items-center gap-2 flex-shrink-0 self-end">
              <button onClick={goToday} className="btn-secondary text-sm">Today</button>
              <div className="flex items-center border border-border rounded-lg overflow-hidden divide-x divide-border bg-white">
                <button onClick={prev} className="px-2.5 py-2 hover:bg-gray-50 transition-colors text-dark">
                  <ChevronLeft size={16} />
                </button>
                <span className="px-4 py-2 text-sm font-medium text-dark whitespace-nowrap select-none">
                  {formatDateRange(startDate, endDate)}
                </span>
                <button onClick={next} className="px-2.5 py-2 hover:bg-gray-50 transition-colors text-dark">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm mb-4">
            {error}
          </div>
        )}

        {/* Calendar card */}
        <div className="card overflow-hidden flex flex-col">
          {/* Legend — outside scroll area so it stays visible */}
          {!loading && (
            <div className="flex flex-wrap items-center gap-5 px-4 py-3 border-b border-border bg-gray-50 flex-shrink-0">
              {[
                { label: 'Airbnb', color: '#E31C5F' },
                { label: 'VRBO / HomeAway', color: '#00A699' },
                { label: 'Booking.com', color: '#003580' },
                { label: 'Direct / Manual', color: '#5B9AB8' },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs text-muted">{label}</span>
                </div>
              ))}
              <span className="text-xs text-muted ml-auto">Click any reservation to view details</span>
            </div>
          )}

          <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
            <div style={{ minWidth: NAME_W + NUM_DAYS * COL_W }}>

              {/* ── Date header ── */}
              <div className="flex border-b border-border sticky top-0 z-30" style={{ height: 54 }}>
                <div
                  className="sticky left-0 z-40 flex-shrink-0 flex items-end px-3 pb-2 border-r border-border bg-gray-50 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]"
                  style={{ width: NAME_W, minWidth: NAME_W }}
                >
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wide">Property</span>
                </div>
                {days.map((day, i) => {
                  const tod = isToday(day);
                  const isWknd = day.getDay() === 0 || day.getDay() === 6;
                  const showMonth = i === 0 || day.getDate() === 1;
                  return (
                    <div
                      key={i}
                      style={{ width: COL_W, minWidth: COL_W }}
                      className={`flex-shrink-0 flex flex-col items-center justify-end pb-1.5 border-r border-border last:border-r-0 ${
                        tod ? 'bg-brand-500' : isWknd ? 'bg-gray-50' : 'bg-white'
                      }`}
                    >
                      {showMonth && (
                        <span className={`text-[9px] font-bold uppercase tracking-wide leading-none mb-0.5 ${tod ? 'text-white/70' : 'text-muted'}`}>
                          {format(day, 'MMM')}
                        </span>
                      )}
                      <span className={`text-xs font-bold leading-none ${tod ? 'text-white' : isWknd ? 'text-gray-400' : 'text-dark'}`}>
                        {format(day, 'd')}
                      </span>
                      <span className={`text-[9px] leading-none mt-0.5 ${tod ? 'text-white/80' : 'text-muted'}`}>
                        {format(day, 'EEE')}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* ── Property rows ── */}
              {loading ? (
                <div className="py-16 text-center">
                  <div className="inline-block w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-muted text-sm">Loading calendar…</p>
                </div>
              ) : (data?.properties || []).length === 0 ? (
                <div className="py-16 text-center text-muted text-sm">No properties found</div>
              ) : (
                (data?.properties || []).map((prop, pi) => {
                  const propResvs = (data?.reservations || []).filter(
                    (r) => r.property_id === prop.id
                  );
                  const isEven = pi % 2 === 0;

                  return (
                    <div
                      key={prop.id}
                      className={`flex border-b border-border last:border-b-0 relative ${isEven ? 'bg-white' : 'bg-gray-50/50'}`}
                      style={{ height: ROW_H }}
                    >
                      {/* Property name — sticky left so it stays visible when scrolling horizontally */}
                      <div
                        className={`sticky left-0 z-20 flex-shrink-0 flex items-center px-3 border-r border-border shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] ${isEven ? 'bg-white' : 'bg-gray-50'}`}
                        style={{ width: NAME_W, minWidth: NAME_W }}
                      >
                        <p className="text-xs font-semibold text-dark truncate">{getPropertyDisplayName(prop) || prop.name}</p>
                      </div>

                      {/* Background grid */}
                      <div
                        className="absolute inset-y-0 flex pointer-events-none"
                        style={{ left: NAME_W }}
                      >
                        {days.map((day, di) => {
                          const dateStr = format(day, 'yyyy-MM-dd');
                          const avail = availability[prop.id]?.[dateStr];
                          const isBlocked = avail && avail.available === false && avail.reason !== 'RESERVED';
                          const tod = isToday(day);
                          const isWknd = day.getDay() === 0 || day.getDay() === 6;
                          return (
                            <div
                              key={di}
                              style={{ width: COL_W }}
                              title={isBlocked && avail.reason ? avail.reason : undefined}
                              className={`border-r border-border last:border-r-0 h-full ${
                                isBlocked
                                  ? 'bg-gray-200'
                                  : tod
                                  ? 'bg-brand-50'
                                  : isWknd
                                  ? isEven ? 'bg-gray-50' : 'bg-gray-100/60'
                                  : ''
                              }`}
                            />
                          );
                        })}
                      </div>

                      {/* Reservation bars */}
                      {propResvs.map((resv) => {
                        const arrStr = (resv.arrival_date || resv.check_in || '').slice(0, 10);
                        const depStr = (resv.departure_date || resv.check_out || '').slice(0, 10);
                        if (!arrStr || !depStr) return null;
                        if (depStr <= startStr || arrStr > endStr) return null;

                        let colStart = differenceInDays(parseISO(arrStr), startDate);
                        let colEnd   = differenceInDays(parseISO(depStr), startDate);
                        colStart = Math.max(0, colStart);
                        colEnd   = Math.min(NUM_DAYS, colEnd);
                        const span = colEnd - colStart;
                        if (span <= 0) return null;

                        const left  = NAME_W + colStart * COL_W + 2;
                        const width = Math.max(span * COL_W - 4, 6);
                        const ps    = platformStyle(resv.platform);
                        const name  = reservationGuestName(resv);
                        const showLabel = width >= 40;

                        return (
                          <button
                            key={resv.id}
                            title={`${name} · ${arrStr} → ${depStr} · ${resv.nights || span} nights · Click to view`}
                            onClick={() => setSelected({ resv, propName: getPropertyDisplayName(prop) || prop.name })}
                            className="absolute top-1.5 bottom-1.5 rounded-md flex items-center overflow-hidden transition-opacity hover:opacity-90 active:opacity-75 focus:outline-none focus:ring-2 focus:ring-white/50"
                            style={{
                              left,
                              width,
                              backgroundColor: ps.bg,
                              color: ps.text,
                              zIndex: 5,
                            }}
                          >
                            {showLabel && (
                              <span className="text-[11px] font-semibold px-2 truncate whitespace-nowrap leading-none">
                                {name}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </Layout>
    </>
  );
}

export const getServerSideProps = requireAuth(async () => ({ props: {} }));
