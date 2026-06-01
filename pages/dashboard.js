import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { addDays, format } from 'date-fns';
import {
  LogIn, LogOut as LogOutIcon, CheckSquare,
  CalendarDays, ArrowRight, AlertCircle, CircleCheckBig,
} from 'lucide-react';
import { taskHeadline, taskGuestSubtitle, formatClock, formatDateShort, reservationHeadline } from '../lib/taskDisplay';
import { formatDateOrDash } from '../lib/dates';
import { fetchJson } from '../lib/apiClient';
import Layout from '../components/Layout';
import PageActionButtons from '../components/PageActionButtons';
import StatCard from '../components/StatCard';
import Badge from '../components/Badge';
import { PageLoader, ErrorState } from '../components/LoadingSpinner';
import ReservationPanel, { reservationGuestName } from '../components/ReservationPanel';
import TaskPetIndicator from '../components/TaskPetIndicator';
import { requireAuth } from '../lib/auth';

function reservationSubtitle(r, mode) {
  if (mode === 'guest-only') return reservationGuestName(r);
  if (mode === 'guest') return `${reservationGuestName(r)} · ${r.platform}`;
  return `${r.code} · ${r.platform}`;
}

function reservationFooter(r, mode) {
  if (mode === 'checkout') {
    const d = r.check_out || r.departure_date;
    return formatDateOrDash(d);
  }
  if (mode === 'checkin') {
    const d = r.check_in || r.arrival_date;
    return formatDateOrDash(d);
  }
  return `${r.nights} night${r.nights !== 1 ? 's' : ''}`;
}

function ReservationList({ items, emptyMsg, subtitle = 'code', footer = 'nights', onSelect }) {
  if (!items?.length) return <p className="text-muted text-sm py-4 text-center">{emptyMsg}</p>;
  return (
    <ul className="divide-y divide-border">
      {items.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            onClick={() => onSelect?.(r)}
            className="w-full py-3 flex items-start justify-between gap-3 text-left hover:bg-gray-50 transition-colors rounded-lg px-1 -mx-1 cursor-pointer"
          >
            <div className="min-w-0">
              <p className="text-sm font-mono font-semibold text-dark tracking-wide truncate">{reservationHeadline(r)}</p>
              <p className="text-xs text-muted mt-0.5">{reservationSubtitle(r, subtitle)}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <Badge label={r.status} variant={r.status} />
              <p className="text-xs text-muted mt-1">{reservationFooter(r, footer)}</p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function TaskList({ items }) {
  if (!items?.length) return <p className="text-muted text-sm py-4 text-center">No tasks due today</p>;
  return (
    <ul className="divide-y divide-border">
      {items.map((t) => (
        <li key={t.id} className="py-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold font-mono text-dark tracking-wide truncate">{taskHeadline(t)}</p>
            <p className="text-xs text-muted mt-0.5 flex items-center gap-1.5">
              <span className="truncate">{taskGuestSubtitle(t)}</span>
              <TaskPetIndicator task={t} size={12} />
            </p>
            <p className="text-xs text-muted mt-0.5">
              Due {formatDateShort(t.due_date)} · {formatClock(t.due_time || '16:00')}
            </p>
          </div>
          <Badge label={t.status === 'unassigned' ? 'Unassigned' : t.status} variant={t.status} />
        </li>
      ))}
    </ul>
  );
}

function reservationQuery({ start, end, tab } = {}) {
  const params = new URLSearchParams();
  if (start) params.set('start', start);
  if (end) params.set('end', end);
  if (tab) params.set('tab', tab);
  const q = params.toString();
  return q ? `/reservations?${q}` : '/reservations';
}

function DashboardPanel({ title, href, children }) {
  return (
    <div className="card p-5">
      <Link
        href={href}
        className="flex items-center justify-between mb-4 -mx-1 px-1 py-1 rounded-lg hover:bg-gray-50 transition-colors group"
      >
        <h2 className="font-semibold text-dark text-sm group-hover:text-brand-600">{title}</h2>
        <span className="text-xs text-brand-500 group-hover:text-brand-600 flex items-center gap-1">
          View all <ArrowRight size={12} />
        </span>
      </Link>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [overdueCount, setOverdueCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState(null);

  async function loadTaskCounts() {
    try {
      const params = new URLSearchParams({ counts_only: 'true', _: String(Date.now()) });
      const json = await fetchJson('/api/tasks?' + params);
      if (json?.counts) {
        setOverdueCount(json.counts.overdue ?? 0);
        setCompletedCount(json.counts.completed ?? 0);
      }
    } catch {
      // Keep existing counts on failure.
    }
  }

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [dashJson] = await Promise.all([
        fetchJson('/api/dashboard'),
        loadTaskCounts(),
      ]);
      if (dashJson) setData(dashJson.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const today = data?.today ? formatDateOrDash(data.today) : '';
  const dashboardLinks = useMemo(() => {
    if (!data?.today) return null;
    const todayIso = data.today;
    const todayDate = new Date(`${todayIso}T12:00:00`);
    const tomorrow = format(addDays(todayDate, 1), 'yyyy-MM-dd');
    const in7days = format(addDays(todayDate, 7), 'yyyy-MM-dd');
    return {
      checkinsToday: reservationQuery({ start: todayIso, end: todayIso, tab: 'active' }),
      checkoutsToday: reservationQuery({ tab: 'active' }),
      tasksToday: '/tasks/assigned?today=true',
      upcomingCheckins: reservationQuery({ start: tomorrow, end: in7days, tab: 'future' }),
      upcomingCheckouts: reservationQuery({ tab: 'active' }),
      occupied: reservationQuery({ tab: 'active' }),
      unassigned: '/tasks/unassigned',
      completed: '/tasks/completed',
      overdue: '/tasks/overdue',
    };
  }, [data?.today]);

  return (
    <>
      <Head><title>Dashboard — Hello Neighbor</title></Head>
      <Layout title="">
        {selected && (
          <ReservationPanel
            resv={selected}
            propName={selected.property_name}
            onClose={() => setSelected(null)}
          />
        )}

        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-dark">Dashboard</h1>
            {today && <p className="text-muted text-sm mt-0.5">{today}</p>}
          </div>
          <PageActionButtons
            onRefresh={load}
            onSynced={load}
            showSync
            refreshing={loading}
          />
        </div>

        {loading && <PageLoader message="Loading dashboard…" />}
        {error && <ErrorState message={error} retry={load} />}

        {data && !loading && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8 w-full auto-rows-fr">
              <StatCard label="Check-ins Today" value={data.stats.checkins_today} icon={LogIn} color="green" href={dashboardLinks?.checkinsToday} />
              <StatCard label="Checkouts Today" value={data.stats.checkouts_today} icon={LogOutIcon} color="green" href={dashboardLinks?.checkoutsToday} />
              <StatCard label="Tasks Due Today" value={data.stats.tasks_today} icon={CheckSquare} color="green" href={dashboardLinks?.tasksToday} />
              <StatCard label="Upcoming Check-ins" value={data.stats.upcoming_checkins} icon={CalendarDays} color="brand" href={dashboardLinks?.upcomingCheckins} />
              <StatCard label="Upcoming Checkouts" value={data.stats.upcoming_checkouts} icon={CalendarDays} color="brand" href={dashboardLinks?.upcomingCheckouts} />
              <StatCard
                label="Unassigned Tasks"
                value={data.stats.tasks_unassigned ?? 0}
                icon={CheckSquare}
                color={(data.stats.tasks_unassigned ?? 0) > 0 ? 'red' : 'brand'}
                href={dashboardLinks?.unassigned}
              />
              <StatCard
                label="Completed Tasks"
                value={completedCount}
                icon={CircleCheckBig}
                color="green"
                href={dashboardLinks?.completed}
              />
              <StatCard
                label="Overdue Tasks"
                value={overdueCount}
                icon={AlertCircle}
                color="red"
                href={dashboardLinks?.overdue}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DashboardPanel title="Occupied Today" href={dashboardLinks?.occupied || '/reservations'}>
                <ReservationList
                  items={data.occupied}
                  emptyMsg="No units occupied today"
                  subtitle="guest-only"
                  footer="checkout"
                  onSelect={setSelected}
                />
              </DashboardPanel>

              <DashboardPanel title="Tasks Due Today" href={dashboardLinks?.tasksToday || '/tasks/assigned'}>
                <TaskList items={data.tasks_today} />
              </DashboardPanel>

              <DashboardPanel title="Upcoming Check-ins (7 days)" href={dashboardLinks?.upcomingCheckins || '/reservations'}>
                <ReservationList
                  items={data.upcoming_check_ins}
                  emptyMsg="No upcoming check-ins"
                  subtitle="guest-only"
                  footer="checkin"
                  onSelect={setSelected}
                />
              </DashboardPanel>

              <DashboardPanel title="Upcoming Checkouts (7 days)" href={dashboardLinks?.upcomingCheckouts || '/reservations'}>
                <ReservationList
                  items={data.upcoming_check_outs}
                  emptyMsg="No upcoming checkouts"
                  subtitle="guest-only"
                  footer="checkout"
                  onSelect={setSelected}
                />
              </DashboardPanel>
            </div>
          </>
        )}
      </Layout>
    </>
  );
}

export const getServerSideProps = requireAuth(async () => ({ props: {} }));
