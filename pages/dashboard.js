import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import {
  Building2, LogIn, LogOut as LogOutIcon, CheckSquare,
  RefreshCw, CalendarDays, Clock, ArrowRight, Plus,
} from 'lucide-react';
import { format } from 'date-fns';
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
    return d ? format(new Date(d), 'MMM d, yyyy') : '—';
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
              <p className="text-sm font-medium text-dark truncate">{r.property_name}</p>
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
            <p className="text-sm font-medium text-dark truncate">{t.title}</p>
            <p className="text-xs text-muted mt-0.5">{t.property_name} · Due {t.due_time}</p>
          </div>
          <Badge label={t.status} variant={t.status} />
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState(null);
  const [properties, setProperties] = useState([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);

  async function load() {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/dashboard');
      if (res.status === 401) { window.location.href = '/'; return; }
      if (!res.ok) throw new Error((await res.json()).error);
      const json = await res.json();
      setData(json.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function syncTasks() {
    setSyncing(true);
    try {
      await fetch('/api/tasks/sync', { method: 'POST' });
      load();
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    fetch('/api/properties')
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json) => setProperties(json.data || []))
      .catch(() => setProperties([]));
  }, []);

  const today = data?.today ? format(new Date(data.today + 'T12:00:00'), 'EEEE, MMMM d, yyyy') : '';

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

        {/* Header row */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-dark">Dashboard</h1>
            {today && <p className="text-muted text-sm mt-0.5">{today}</p>}
          </div>
          <div className="flex flex-wrap gap-2 flex-shrink-0 justify-end">
            <button
              type="button"
              onClick={() => setShowTaskModal(true)}
              className="btn-primary text-xs gap-1.5"
            >
              <Plus size={14} />
              New Task
            </button>
            <button
              type="button"
              onClick={() => setShowTransactionModal(true)}
              className="btn-primary text-xs gap-1.5"
            >
              <Plus size={14} />
              New Transaction
            </button>
            <button
              onClick={syncTasks}
              disabled={syncing}
              className="btn-secondary text-xs gap-1.5"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing…' : 'Sync Tasks'}
            </button>
            <button onClick={load} className="btn-secondary text-xs gap-1.5">
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        </div>

        {loading && <PageLoader message="Loading dashboard…" />}
        {error && <ErrorState message={error} retry={load} />}

        {data && !loading && (
          <>
            {/* Stat cards — 3 per row */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              <StatCard
                label="Occupied Now"
                value={data.stats.occupied_count}
                icon={Building2}
                color="brand"
              />
              <StatCard
                label="Check-ins Today"
                value={data.stats.checkins_today}
                icon={LogIn}
                color="green"
              />
              <StatCard
                label="Checkouts Today"
                value={data.stats.checkouts_today}
                icon={LogOutIcon}
                color="amber"
              />
              <StatCard
                label="Tasks Due Today"
                value={data.stats.tasks_today}
                icon={CheckSquare}
                color={data.stats.tasks_today > 0 ? 'red' : 'brand'}
              />
              <StatCard
                label="Upcoming Check-ins"
                value={data.stats.upcoming_checkins}
                icon={CalendarDays}
                color="brand"
              />
              <StatCard
                label="Upcoming Checkouts"
                value={data.stats.upcoming_checkouts}
                icon={Clock}
                color="amber"
              />
            </div>

            {/* Detail panels — two rows of two */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-dark text-sm">Occupied Today</h2>
                  <Link href="/reservations" className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1">
                    View all <ArrowRight size={12} />
                  </Link>
                </div>
                <ReservationList items={data.occupied} emptyMsg="No units occupied today" subtitle="guest-only" onSelect={setSelected} />
              </div>

              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-dark text-sm">Upcoming Check-ins (7 days)</h2>
                  <Link href="/reservations" className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1">
                    View all <ArrowRight size={12} />
                  </Link>
                </div>
                <ReservationList items={data.upcoming_check_ins} emptyMsg="No upcoming check-ins" subtitle="guest-only" onSelect={setSelected} />
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
