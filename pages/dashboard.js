import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import {
  Building2, LogIn, LogOut as LogOutIcon, CheckSquare,
  RefreshCw, CalendarDays, Clock, ArrowRight, Plus, CircleCheckBig, AlertCircle,
} from 'lucide-react';
import { taskHeadline, taskGuestSubtitle, formatClock, reservationHeadline } from '../lib/taskDisplay';
import { formatDateOrDash } from '../lib/dates';
import { fetchJson } from '../lib/apiClient';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import Badge from '../components/Badge';
import { PageLoader, ErrorState } from '../components/LoadingSpinner';
import ReservationPanel, { reservationGuestName } from '../components/ReservationPanel';
import TaskModal from '../components/TaskModal';
import ExpenseModal from '../components/ExpenseModal';
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
            <p className="text-xs text-muted mt-0.5">{taskGuestSubtitle(t)}</p>
            <p className="text-xs text-muted mt-0.5">
              Due {formatClock(t.due_time || '16:00')}
            </p>
          </div>
          <Badge label={t.status === 'unassigned' ? 'Unassigned' : t.status} variant={t.status} />
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [taskCounts, setTaskCounts] = useState({ completed: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState(null);
  const [properties, setProperties] = useState([]);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);

  async function loadTaskCounts() {
    try {
      const params = new URLSearchParams({ counts_only: 'true', _: String(Date.now()) });
      const json = await fetchJson('/api/tasks?' + params);
      if (json?.counts) {
        setTaskCounts({
          completed: json.counts.completed ?? 0,
          overdue: json.counts.overdue ?? 0,
        });
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

  async function ensureProperties() {
    if (properties.length || propertiesLoading) return properties;
    setPropertiesLoading(true);
    try {
      const json = await fetchJson('/api/properties');
      const list = json?.data || [];
      setProperties(list);
      return list;
    } catch {
      return [];
    } finally {
      setPropertiesLoading(false);
    }
  }

  async function openTaskModal() {
    await ensureProperties();
    setShowTaskModal(true);
  }

  async function openTransactionModal() {
    await ensureProperties();
    setShowTransactionModal(true);
  }

  async function syncTasks() {
    setSyncing(true);
    try {
      await fetchJson('/api/tasks/sync', { method: 'POST' });
      load();
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => { load(); }, []);

  const today = data?.today ? formatDateOrDash(data.today) : '';

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
        {showTaskModal && (
          <TaskModal
            properties={properties}
            onClose={() => setShowTaskModal(false)}
            onSaved={load}
          />
        )}
        {showTransactionModal && (
          <ExpenseModal
            properties={properties}
            onClose={() => setShowTransactionModal(false)}
            onSaved={() => setShowTransactionModal(false)}
          />
        )}

        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-dark">Dashboard</h1>
            {today && <p className="text-muted text-sm mt-0.5">{today}</p>}
          </div>
          <div className="flex flex-col gap-2 w-full md:flex-row md:flex-wrap md:justify-end">
            <button
              type="button"
              onClick={openTaskModal}
              className="btn-primary text-xs gap-1.5 justify-center"
            >
              <Plus size={14} />
              New Task
            </button>
            <button
              type="button"
              onClick={openTransactionModal}
              className="btn-primary text-xs gap-1.5 justify-center"
            >
              <Plus size={14} />
              New Transaction
            </button>
            <button
              type="button"
              onClick={syncTasks}
              disabled={syncing}
              className="btn-secondary text-xs gap-1.5 justify-center"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing…' : 'Sync from Reservations'}
            </button>
            <button type="button" onClick={load} className="btn-secondary text-xs gap-1.5 justify-center">
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        </div>

        {loading && <PageLoader message="Loading dashboard…" />}
        {error && <ErrorState message={error} retry={load} />}

        {data && !loading && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8 w-full">
              <StatCard label="Occupied Now" value={data.stats.occupied_count} icon={Building2} color="brand" />
              <StatCard label="Check-ins Today" value={data.stats.checkins_today} icon={LogIn} color="green" />
              <StatCard label="Checkouts Today" value={data.stats.checkouts_today} icon={LogOutIcon} color="amber" />
              <StatCard label="Tasks Due Today" value={data.stats.tasks_today} icon={CheckSquare} color={data.stats.tasks_today > 0 ? 'red' : 'brand'} />
              <Link href="/tasks" className="block">
                <StatCard
                  label="Unassigned Tasks"
                  value={data.stats.tasks_unassigned ?? 0}
                  icon={CheckSquare}
                  color={(data.stats.tasks_unassigned ?? 0) > 0 ? 'red' : 'brand'}
                  sub="Needs assignee"
                />
              </Link>
              <Link href="/tasks?tab=completed" className="block">
                <StatCard
                  label="Completed Tasks"
                  value={taskCounts.completed}
                  icon={CircleCheckBig}
                  color="green"
                />
              </Link>
              <Link href="/tasks?tab=overdue" className="block">
                <StatCard
                  label="Overdue Tasks"
                  value={taskCounts.overdue}
                  icon={AlertCircle}
                  color={taskCounts.overdue > 0 ? 'red' : 'brand'}
                  sub={taskCounts.overdue > 0 ? 'Needs attention' : undefined}
                />
              </Link>
              <StatCard label="Upcoming Check-ins" value={data.stats.upcoming_checkins} icon={CalendarDays} color="brand" />
              <StatCard label="Upcoming Checkouts" value={data.stats.upcoming_checkouts} icon={Clock} color="amber" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-dark text-sm">Occupied Today</h2>
                  <Link href="/reservations" className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1">
                    View all <ArrowRight size={12} />
                  </Link>
                </div>
                <ReservationList
                  items={data.occupied}
                  emptyMsg="No units occupied today"
                  subtitle="guest-only"
                  footer="checkout"
                  onSelect={setSelected}
                />
              </div>

              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-dark text-sm">Upcoming Check-ins (7 days)</h2>
                  <Link href="/reservations" className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1">
                    View all <ArrowRight size={12} />
                  </Link>
                </div>
                <ReservationList
                  items={data.upcoming_check_ins}
                  emptyMsg="No upcoming check-ins"
                  subtitle="guest-only"
                  footer="checkin"
                  onSelect={setSelected}
                />
              </div>

              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-dark text-sm">Tasks Due Today</h2>
                  <Link href="/tasks" className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1">
                    View all <ArrowRight size={12} />
                  </Link>
                </div>
                <TaskList items={data.tasks_today} />
              </div>

              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-dark text-sm">Upcoming Checkouts (7 days)</h2>
                  <Link href="/reservations" className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1">
                    View all <ArrowRight size={12} />
                  </Link>
                </div>
                <ReservationList
                  items={data.upcoming_check_outs}
                  emptyMsg="No upcoming checkouts"
                  subtitle="guest-only"
                  footer="checkout"
                  onSelect={setSelected}
                />
              </div>
            </div>
          </>
        )}
      </Layout>
    </>
  );
}

export const getServerSideProps = requireAuth(async () => ({ props: {} }));
