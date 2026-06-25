import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import {
  format, addDays, isToday, parseISO, differenceInDays,
} from 'date-fns';
import Layout from '../components/Layout';
import ReservationPanel, { reservationGuestName } from '../components/ReservationPanel';
import { fetchJson } from '../lib/apiClient';
import { formatDateRange } from '../lib/dates';
import { platformStyle } from '../lib/platformStyles';
import { getPropertyDisplayName } from '../lib/codes';
import { isConfirmedReservation } from '../lib/reservationDates';
import { requireAuth } from '../lib/auth';

const COL_W         = 42;
const ROW_H         = 48;
const HEADER_H      = 36;
const NAME_W        = 180;
const INITIAL_DAYS  = 42;
const LOAD_MORE_DAYS = 28;
const SCROLL_THRESHOLD = 320;

function reservationBarGeometry(arrStr, depStr, startDate, numDays) {
  const arrIdx = differenceInDays(parseISO(arrStr), startDate);
  const depIdx = differenceInDays(parseISO(depStr), startDate);
  if (depIdx <= arrIdx) return null;
  if (depIdx <= 0 || arrIdx >= numDays) return null;

  let leftPx  = NAME_W + arrIdx * COL_W + COL_W / 2;
  let rightPx = NAME_W + depIdx * COL_W + COL_W / 2;

  const clipLeft  = NAME_W;
  const clipRight = NAME_W + numDays * COL_W;
  leftPx  = Math.max(leftPx, clipLeft);
  rightPx = Math.min(rightPx, clipRight);

  const width = rightPx - leftPx;
  if (width <= 2) return null;

  return { leftPx, width };
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const anchorStart = useRef((() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return addDays(d, -7);
  })());

  const [numDays, setNumDays] = useState(INITIAL_DAYS);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const scrollRef = useRef(null);
  const loadingMoreRef = useRef(false);
  const loadedEndRef = useRef('');

  const startDate = anchorStart.current;
  const days    = Array.from({ length: numDays }, (_, i) => addDays(startDate, i));
  const endDate = days[days.length - 1];
  const startStr = format(startDate, 'yyyy-MM-dd');
  const endStr   = format(endDate, 'yyyy-MM-dd');

  const load = useCallback(async ({ append = false } = {}) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError('');
    try {
      const params = new URLSearchParams({ start: startStr, end: endStr });
      const json = await fetchJson('/api/calendar?' + params);
      if (json) {
        setData(json.data);
        loadedEndRef.current = endStr;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }, [startStr, endStr]);

  useEffect(() => {
    if (loadedEndRef.current && endStr <= loadedEndRef.current) return;
    load({ append: Boolean(loadedEndRef.current) });
  }, [endStr, load]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function onScroll() {
      const nearRight = el.scrollLeft + el.clientWidth >= el.scrollWidth - SCROLL_THRESHOLD;
      if (nearRight && !loadingMoreRef.current && !loading && !loadingMore) {
        loadingMoreRef.current = true;
        setNumDays((n) => n + LOAD_MORE_DAYS);
      }
    }

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [loading, loadingMore]);

  function scrollToToday() {
    const el = scrollRef.current;
    if (!el) return;
    const todayIdx = differenceInDays(new Date(), startDate);
    if (todayIdx < 0 || todayIdx >= numDays) return;
    const target = todayIdx * COL_W - el.clientWidth / 2 + COL_W / 2;
    el.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }

  const availability = data?.availability || {};
  const properties = (data?.properties || []).filter((p) => p.listed);
  const reservations = (data?.reservations || []).filter(isConfirmedReservation);

  return (
    <>
      <Head><title>Calendar — Hello Neighbor</title></Head>
      <Layout title="">

        {selected && (
          <ReservationPanel
            resv={selected.resv}
            propName={selected.propName}
            onClose={() => setSelected(null)}
          />
        )}

        <div className="flex flex-col gap-4 mb-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-dark">Calendar</h1>
          </div>
          <div className="flex flex-col gap-3 w-full lg:w-auto lg:items-end">
            <div className="flex items-center gap-2 flex-shrink-0 self-end">
              <button type="button" onClick={scrollToToday} className="btn-secondary text-sm">Today</button>
              <span className="px-3 py-1.5 text-sm font-medium text-dark whitespace-nowrap select-none border border-border rounded-lg bg-white">
                {formatDateRange(startDate, endDate)}
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm mb-4">
            {error}
          </div>
        )}

        <div className="card overflow-hidden flex flex-col">
          {!loading && (
            <div className="flex flex-wrap items-center gap-5 px-4 py-3 border-b border-border bg-gray-50 flex-shrink-0">
              {[
                { label: 'Airbnb', color: '#FF5A5F' },
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

          <div
            ref={scrollRef}
            className="overflow-auto"
            style={{ maxHeight: 'calc(100vh - 240px)' }}
          >
            <div style={{ minWidth: NAME_W + numDays * COL_W }}>

              {/* ── Date header ── */}
              <div className="flex border-b border-border sticky top-0 z-30" style={{ height: HEADER_H }}>
                <div
                  className="sticky left-0 z-40 flex-shrink-0 flex items-end px-3 pb-1 border-r border-border bg-gray-50 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]"
                  style={{ width: NAME_W, minWidth: NAME_W }}
                >
                  <span className="text-[10px] font-semibold text-muted uppercase tracking-wide leading-none">Property</span>
                </div>
                {days.map((day, i) => {
                  const tod = isToday(day);
                  const isWknd = day.getDay() === 0 || day.getDay() === 6;
                  const showMonth = i === 0 || day.getDate() === 1;
                  return (
                    <div
                      key={i}
                      style={{ width: COL_W, minWidth: COL_W }}
                      className={`flex-shrink-0 flex flex-col items-center justify-end pb-0.5 border-r border-border last:border-r-0 ${
                        tod ? 'bg-brand-500' : isWknd ? 'bg-gray-50' : 'bg-white'
                      }`}
                    >
                      {showMonth && (
                        <span className={`text-[8px] font-bold uppercase tracking-wide leading-none mb-px ${tod ? 'text-white/70' : 'text-muted'}`}>
                          {format(day, 'MMM')}
                        </span>
                      )}
                      <span className={`text-[11px] font-bold leading-none ${tod ? 'text-white' : isWknd ? 'text-gray-400' : 'text-dark'}`}>
                        {format(day, 'd')}
                      </span>
                      <span className={`text-[8px] leading-none ${tod ? 'text-white/80' : 'text-muted'}`}>
                        {format(day, 'EEE')}
                      </span>
                    </div>
                  );
                })}
              </div>

              {loading && !data ? (
                <div className="py-16 text-center">
                  <div className="inline-block w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-muted text-sm">Loading calendar…</p>
                </div>
              ) : properties.length === 0 ? (
                <div className="py-16 text-center text-muted text-sm">No active properties found</div>
              ) : (
                properties.map((prop, pi) => {
                  const propResvs = reservations.filter((r) => r.property_id === prop.id);
                  const isEven = pi % 2 === 0;

                  return (
                    <div
                      key={prop.id}
                      className={`flex border-b border-border last:border-b-0 relative ${isEven ? 'bg-white' : 'bg-gray-50/50'}`}
                      style={{ height: ROW_H }}
                    >
                      <div
                        className={`sticky left-0 z-20 flex-shrink-0 flex items-center px-3 border-r border-border shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] ${isEven ? 'bg-white' : 'bg-gray-50'}`}
                        style={{ width: NAME_W, minWidth: NAME_W }}
                      >
                        <p className="text-xs font-semibold text-dark truncate">{getPropertyDisplayName(prop) || prop.name}</p>
                      </div>

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

                      {propResvs.map((resv) => {
                        const arrStr = (resv.arrival_date || resv.check_in || '').slice(0, 10);
                        const depStr = (resv.departure_date || resv.check_out || '').slice(0, 10);
                        if (!arrStr || !depStr) return null;

                        const geom = reservationBarGeometry(arrStr, depStr, startDate, numDays);
                        if (!geom) return null;

                        const ps = platformStyle(resv.platform);
                        const name = reservationGuestName(resv);
                        const showLabel = geom.width >= 40;

                        return (
                          <button
                            key={resv.id}
                            type="button"
                            title={`${name} · ${arrStr} → ${depStr} · ${resv.nights || ''} nights · Click to view`}
                            onClick={() => setSelected({ resv, propName: getPropertyDisplayName(prop) || prop.name })}
                            className="absolute top-1.5 bottom-1.5 rounded-md flex items-center overflow-hidden transition-opacity hover:opacity-90 active:opacity-75 focus:outline-none focus:ring-2 focus:ring-white/50"
                            style={{
                              left: geom.leftPx + 1,
                              width: Math.max(geom.width - 2, 4),
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

              {loadingMore && (
                <div className="py-2 text-center text-xs text-muted border-t border-border bg-gray-50">
                  Loading more dates…
                </div>
              )}
            </div>
          </div>
        </div>
      </Layout>
    </>
  );
}

export const getServerSideProps = requireAuth(async () => ({ props: {} }));
