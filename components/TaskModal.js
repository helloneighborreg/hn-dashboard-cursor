import { useState } from 'react';
import { X } from 'lucide-react';

const ASSIGNEES = ['Brandi Drielsien', 'Josiah Burton', 'Rachel Jackson', 'Other'];
const TASK_TYPES = ['turnover', 'maintenance', 'inspection', 'other'];

export default function TaskModal({ properties, onClose, onSaved }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    title: '',
    property_id: '',
    due_date: today,
    due_time: '16:00',
    description: '',
    assignee: '',
    type: 'other',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!form.title.trim() || !form.property_id || !form.due_date) {
      setErr('Title, property, and due date are required');
      return;
    }
    setSaving(true);
    try {
      const prop = properties.find((p) => p.id === form.property_id);
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          property_id: form.property_id,
          property_name: prop?.name || '',
          due_date: form.due_date,
          due_time: form.due_time || '16:00',
          checkout_date: form.due_date,
          description: form.description,
          assignee: form.assignee || null,
          type: form.type,
          notes: form.notes || null,
          status: form.assignee ? 'assigned' : 'unassigned',
        }),
      });
      if (!res.ok) {
        setErr((await res.json()).error);
        return;
      }
      onSaved?.();
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-semibold text-dark">New Task</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-dark">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="label">Title *</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Deep clean after checkout"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">Property *</label>
            <select
              className="select"
              value={form.property_id}
              onChange={(e) => setForm((f) => ({ ...f, property_id: e.target.value }))}
              required
            >
              <option value="">Select a property…</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Due date *</label>
              <input
                type="date"
                className="input"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Due time</label>
              <input
                type="time"
                className="input"
                value={form.due_time}
                onChange={(e) => setForm((f) => ({ ...f, due_time: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select
                className="select"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                {TASK_TYPES.map((t) => (
                  <option key={t} value={t} className="capitalize">
                    {t.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Assignee</label>
              <select
                className="select"
                value={form.assignee}
                onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value }))}
              >
                <option value="">Unassigned</option>
                {ASSIGNEES.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Optional details…"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Optional notes…"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          {err && <p className="text-red-600 text-sm">{err}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? 'Saving…' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
