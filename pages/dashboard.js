import { useState, useEffect, useMemo, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import clsx from 'clsx';
import { addDays, format } from 'date-fns';
import {
  LogIn, LogOut as LogOutIcon, CheckSquare,
  CalendarDays, ArrowRight, AlertCircle, CircleCheckBig, ChevronDown,
} from 'lucide-react';
import { taskHeadline, taskGuestSubtitle, formatClock, formatDateShort, reservationHeadline } from '../lib/taskDisplay';
import { formatDateOrDash } from '../lib/dates';
import { fetchJson } from '../lib/apiClient';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import Badge from '../components/Badge';
import { PageLoader, ErrorState } from '../components/LoadingSpinner';
import ReservationPanel, { reservationGuestName } from '../components/ReservationPanel';
import TaskPetIndicator from '../components/TaskPetIndicator';
import { useAuth } from '../components/AuthContext';
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

function TaskList({ items, emptyMsg = 'No tasks due today', showDue = true }) {
  if (!items?.length) return <p className="text-muted text-sm py-4 text-center">{emptyMsg}</p>;
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
            {showDue && (
              <p className="text-xs text-muted mt-0.5">
                Due {formatDateShort(t.due_date)} · {formatClock(t.due_time || '16:00')}
              </p>
            )}
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

function DashboardPanel({ title, href, children, collapsible = false, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);

  const viewAllLink = (
    <Link
      href={href}
      className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1 flex-shrink-0"
    >
      View All <ArrowRight size={12} />
    </Link>
  );

  return (
    <div className="card p-5">
      <div className={clsx('flex items-center justify-between gap-3', (open || !collapsible) && 'mb-4')}>
        {collapsible ? (
          <>
            <button
              type="button"
              onClick={() => setOpen((prev) => !prev)}
              className="flex items-center gap-2 min-w-0 -mx-1 px-1 py-1 rounded-lg hover:bg-gray-50 transition-colors text-left group"
              aria-expanded={open}
            >
              <h2 className="font-semibold text-dark text-sm group-hover:text-brand-600">{title}</h2>
              <ChevronDown
                size={16}
                className={clsx('text-muted flex-shrink-0 transition-transform', open && 'rotate-180')}
              />
            </button>
            {viewAllLink}
          </>
        ) : (
          <Link
            href={href}
            className="flex items-center justify-between w-full -mx-1 px-1 py-1 rounded-lg hover:bg-gray-50 transition-colors group"
          >
            <h2 className="font-semibold text-dark text-sm group-hover:text-brand-600">{title}</h2>
            {viewAllLink}
          </Link>
        )}
      </div>
      {(!collapsible || open) && children}
    </div>
  );
}

export default function DashboardPage() {
  const { isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const dashJson = await fetchJson('/api/dashboard');
      if (dashJson) setData(dashJson.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => { load(); }, [isAdmin]);

  useEffect(() => {
    function onTasksSynced() {
      loadRef.current();
    }
    window.addEventListener('hn:tasks-synced', onTasksSynced);
    return () => window.removeEventListener('hn:tasks-synced', onTasksSynced);
  }, []);

  const isTaskDashboard = data?.view === 'tasks';

  const adminLinks = useMemo(() => {
    if (!isAdmin || !data?.today) return null;
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
  }, [isAdmin, data?.today]);

  const taskLinks = useMemo(() => ({
    tasksToday: '/tasks/assigned?today=true',
    completed: '/tasks/completed',
    overdue: '/tasks/overdue',
  }), []);

  return (
    <>
      <Head><title>Dashboard — Hello Neighbor</title></Head>
      <Layout title="">
        {!isTaskDashboard && selected && (
          <ReservationPanel
            resv={selected}
            propName={selected.property_name}
            onClose={() => setSelected(null)}
          />
        )}

        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-dark">Dashboard</h1>
        </div>

        {loading && <PageLoader message="Loading dashboard…" />}
        {error && <ErrorState message={error} retry={load} />}

        {data && !loading && isTaskDashboard && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8 w-full auto-rows-fr">
              <StatCard label="Tasks Due Today" value={data.stats.tasks_today} icon={CheckSquare} color="green" href={taskLinks.tasksToday} />
              <StatCard label="Completed Tasks" value={data.stats.tasks_completed} icon={CircleCheckBig} color="green" href={taskLinks.completed} />
              <StatCard label="Overdue Tasks" value={data.stats.tasks_overdue} icon={AlertCircle} color="red" href={taskLinks.overdue} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DashboardPanel title="Tasks Due Today" href={taskLinks.tasksToday}>
                <TaskList items={data.tasks_today} showDue={false} />
              </DashboardPanel>

              <DashboardPanel title="Completed Tasks" href={taskLinks.completed}>
                <TaskList items={data.tasks_completed} emptyMsg="No completed tasks" />
              </DashboardPanel>

              <DashboardPanel title="Overdue Tasks" href={taskLinks.overdue}>
                <TaskList items={data.tasks_overdue} emptyMsg="No overdue tasks" />
              </DashboardPanel>
            </div>
          </>
        )}

        {data && !loading && !isTaskDashboard && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8 w-full auto-rows-fr">
              <StatCard label="Check-Ins Today" value={data.stats.checkins_today} icon={LogIn} color="green" href={adminLinks?.checkinsToday} />
              <StatCard label="Checkouts Today" value={data.stats.checkouts_today} icon={LogOutIcon} color="green" href={adminLinks?.checkoutsToday} />
              <StatCard label="Tasks Due Today" value={data.stats.tasks_today} icon={CheckSquare} color="green" href={adminLinks?.tasksToday} />
              <StatCard label="Upcoming Check-Ins" value={data.stats.upcoming_checkins} icon={CalendarDays} color="brand" href={adminLinks?.upcomingCheckins} />
              <StatCard label="Upcoming Checkouts" value={data.stats.upcoming_checkouts} icon={CalendarDays} color="brand" href={adminLinks?.upcomingCheckouts} />
              <StatCard
                label="Unassigned Tasks"
                value={data.stats.tasks_unassigned ?? 0}
                icon={CheckSquare}
                color="brand"
                href={adminLinks?.unassigned}
              />
              <StatCard
                label="Completed Tasks"
                value={data.stats.tasks_completed ?? 0}
                icon={CircleCheckBig}
                color="green"
                href={adminLinks?.completed}
              />
              <StatCard
                label="Overdue Tasks"
                value={data.stats.tasks_overdue ?? 0}
                icon={AlertCircle}
                color="red"
                href={adminLinks?.overdue}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DashboardPanel title="Occupied Today" href={adminLinks?.occupied || '/reservations'} collapsible>
                <ReservationList
                  items={data.occupied}
                  emptyMsg="No units occupied today"
                  subtitle="guest-only"
                  footer="checkout"
                  onSelect={setSelected}
                />
              </DashboardPanel>

              <DashboardPanel title="Tasks Due Today" href={adminLinks?.tasksToday || '/tasks/assigned'} collapsible>
                <TaskList items={data.tasks_today} showDue={false} />
              </DashboardPanel>

              <DashboardPanel title="Upcoming Check-Ins (Next 7 Days)" href={adminLinks?.upcomingCheckins || '/reservations'} collapsible>
                <ReservationList
                  items={data.upcoming_check_ins}
                  emptyMsg="No upcoming check-ins"
                  subtitle="guest-only"
                  footer="checkin"
                  onSelect={setSelected}
                />
              </DashboardPanel>

              <DashboardPanel title="Upcoming Checkouts (Next 7 Days)" href={adminLinks?.upcomingCheckouts || '/reservations'} collapsible>
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
