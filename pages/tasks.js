import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Plus, RefreshCw, Filter, CheckCircle2, Circle, AlertCircle, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import Layout from '../components/Layout';
import Badge from '../components/Badge';
import { PageLoader, ErrorState, EmptyState } from '../components/LoadingSpinner';
import { requireAuth } from '../lib/auth';

const ASSIGNEES = ['Brandi Drielsien', 'Josiah Burton', 'Rachel Jackson', 'Other'];
const STATUSES = ['unassigned', 'assigned', 'in_progress', 'completed'];

function TaskRow({ task, properties, onUpdate, onDelete }) {
  const [saving, setSaving] = useState(false);

  async function patch(updates) {
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) { const json = await res.json(); onUpdate(json.data); }
    } finally { setSaving(false); }
  }

  const isOverdue = task.due_date < new Date().toISOString().slice(0, 10) && task.status !== 'completed';
  const statusColor = {
    unassigned: 'red', assigned: 'brand', in_progress: 'amber', completed: 'green',
  }[task.status] || 'default';

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="table-cell">
        <div className="flex items-start gap-2">
          <button
            onClick={() => patch({ status: task.status === 'completed' ? 'unassigned' : 'completed' })}
            className={`mt-0.5 flex-shrink-0 ${task.status === 'completed' ? 'text-green-500' : 'text-gray-300 hover:text-brand-400'} transition-colors`}
            disabled={saving}
          >
            {task.status === 'completed' ? <CheckCircle2 size={18} /> : <Circle size={18} />}
          </button>
          <div className="min-w-0">
            <p className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-muted' : 'text-dark'} truncate max-w-xs`}>
              {task.title}
            </p>
            {task.description && (
              <p className="text-xs text-muted truncate max-w-xs mt-0.5">{task.description}</p>
            )}
          </div>
        </div>
      </td>
      <td className="table-cell">
        <p className="text-sm font-medium truncate max-w-48">{task.property_name}</p>
      </td>
      <td className="table-cell">
        <p className={isOverdue ? 'text-red-600 font-semibold' : ''}>
          {format(new Date(task.due_date + 'T12:00:00'), 'MMM d, yyyy')}
        </p>
        <p className="text-xs text-muted">{task.due_time || '16:00'}</p>
        {isOverdue && <span className="text-xs text-red-600 font-medium">Overdue</span>}
      </td>
      <td className="table-cell">
        <select
          className="select text-xs py-1 w-44"
          value={task.assignee || ''}
          onChange={(e) => patch({ assignee: e.target.value || null, status: e.target.value ? 'assigned' : 'unassigned' })}
          disabled={saving}
        >
          <option value="">Unassigned</option>
          {ASSIGNEES.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </td>
      <td className="table-cell">
        <select
          className="select text-xs py-1 w-36"
          value={task.status}
          onChange={(e) => patch({ status: e.target.value })}
          disabled={saving}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </td>
      <td className="table-cell text-xs text-muted capitalize">{task.type}</td>
      <td className="table-cell">
        <div className="flex items-center gap-2">
          <Link href={`/reservations?code=${task.reservation_id}`} className="text-brand-500 hover:text-brand-600">
            <ExternalLink size={14} />
          </Link>
          <button
            onClick={async () => {
              if (!confirm('Delete this task?')) return;
              await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
              onDelete(task.id);
            }}
            className="text-red-400 hover:text-red-600 transition-colors"
          >
            ✕
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [filters, setFilters] = useState({
    property_id: '', status: '', assignee: '', date_from: '', date_to: '',
    today: false,
  });

  async function load() {
    setLoading(true); setError('');
    try {
      const [propsRes] = await Promise.all([fetch('/api/properties')]);
      if (propsRes.status === 401) { window.location.href = '/'; return; }
      const propsJson = await propsRes.json();
      setProperties(propsJson.data || []);

      const params = new URLSearchParams();
      if (filters.property_id) params.set('property_id', filters.property_id);
      if (filters.status) params.set('status', filters.status);
      if (filters.assignee) params.set('assignee', filters.assignee);
      if (filters.today) params.set('today', 'true');
      if (filters.date_from) params.set('date_from', filters.date_from);
      if (filters.date_to) params.set('date_to', filters.date_to);

      const res = await fetch('/api/tasks?' + params);
      if (!res.ok) throw new Error((await res.json()).error);
      const json = await res.json();
      setTasks(json.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function syncTasks() {
    setSyncing(true);
    try {
      const res = await fetch('/api/tasks/sync', { method: 'POST' });
      const json = await res.json();
      alert(`Sync complete. Created ${json.created ?? 0} new task(s).`);
      load();
    } catch (err) {
      alert('Sync failed: ' + err.message);
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => { load(); }, []);

  function handleUpdate(updated) {
    setTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t));
  }
  function handleDelete(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  const stats = useMemo(() => {
    const unassigned = tasks.filter((t) => t.status === 'unassigned').length;
    const overdue = tasks.filter((t) => t.due_date < new Date().toISOString().slice(0, 10) && t.status !== 'completed').length;
    const today = tasks.filter((t) => t.due_date === new Date().toISOString().slice(0, 10)).length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    return { unassigned, overdue, today, completed };
  }, [tasks]);

  return (
    <>
      <Head><title>Tasks — Hello Neighbor</title></Head>
      <Layout title="">
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-dark">Tasks</h1>
            <p className="text-muted text-sm mt-0.5">{tasks.length} total tasks</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={syncTasks}
              disabled={syncing}
              className="btn-secondary text-xs gap-1.5"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing…' : 'Sync from Hospitable'}
            </button>
            <button onClick={load} className="btn-secondary text-xs gap-1.5">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Unassigned', value: stats.unassigned, color: 'bg-red-50 text-red-700 border-red-100' },
            { label: 'Due Today', value: stats.today, color: 'bg-amber-50 text-amber-700 border-amber-100' },
            { label: 'Overdue', value: stats.overdue, color: 'bg-red-50 text-red-600 border-red-100' },
            { label: 'Completed', value: stats.completed, color: 'bg-green-50 text-green-700 border-green-100' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`card border p-4 ${color.split(' ')[2]}`}>
              <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'inherit', opacity: 0.7 }}>{label}</p>
              <p className={`text-2xl font-bold ${color.split(' ')[1]}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="card p-4 mb-5">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 items-end">
            <div>
              <label className="label">Property</label>
              <select className="select" value={filters.property_id} onChange={(e) => setFilters(f => ({ ...f, property_id: e.target.value }))}>
                <option value="">All properties</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="select" value={filters.status} onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}>
                <option value="">All statuses</option>
                <option value="unassigned">Unassigned</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="label">Assignee</label>
              <select className="select" value={filters.assignee} onChange={(e) => setFilters(f => ({ ...f, assignee: e.target.value }))}>
                <option value="">All assignees</option>
                {ASSIGNEES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Due from</label>
              <input type="date" className="input" value={filters.date_from} onChange={(e) => setFilters(f => ({ ...f, date_from: e.target.value }))} />
            </div>
            <div>
              <label className="label">Due to</label>
              <input type="date" className="input" value={filters.date_to} onChange={(e) => setFilters(f => ({ ...f, date_to: e.target.value }))} />
            </div>
            <div>
              <label className="label">&nbsp;</label>
              <label className="flex items-center gap-2 cursor-pointer h-[38px]">
                <input type="checkbox" checked={filters.today} onChange={(e) => setFilters(f => ({ ...f, today: e.target.checked }))} className="rounded text-brand-500" />
                <span className="text-sm">Today only</span>
              </label>
            </div>
            <div>
              <label className="label">&nbsp;</label>
              <button onClick={load} className="btn-primary w-full justify-center gap-1.5">
                <Filter size={14} /> Apply
              </button>
            </div>
          </div>
        </div>

        {loading && <PageLoader message="Loading tasks…" />}
        {error && <ErrorState message={error} retry={load} />}

        {!loading && !error && (
          tasks.length === 0
            ? (
              <EmptyState
                title="No tasks found"
                message='Click "Sync from Hospitable" to automatically generate turnover tasks from upcoming checkouts.'
                action={
                  <button onClick={syncTasks} disabled={syncing} className="btn-primary mt-2">
                    {syncing ? 'Syncing…' : 'Sync Tasks Now'}
                  </button>
                }
              />
            )
            : (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-border">
                      <tr>
                        <th className="table-head">Task</th>
                        <th className="table-head">Property</th>
                        <th className="table-head">Due Date</th>
                        <th className="table-head">Assignee</th>
                        <th className="table-head">Status</th>
                        <th className="table-head">Type</th>
                        <th className="table-head">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {tasks.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          properties={properties}
                          onUpdate={handleUpdate}
                          onDelete={handleDelete}
                        />
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
