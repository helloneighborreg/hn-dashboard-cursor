import { useState } from 'react';
import { X } from 'lucide-react';

export const EXPENSE_CATEGORIES = [
  'Cleaning', 'Maintenance', 'Supplies', 'Utilities', 'Insurance',
  'Platform Fees', 'Photography', 'Marketing', 'Professional Services',
  'Furnishings', 'Repairs', 'Travel', 'Software', 'Other',
];

export default function ExpenseModal({ properties, onClose, onSaved, title = 'Add Transaction' }) {
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    property_id: '',
    category: '',
    vendor: '',
    amount: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!form.property_id || !form.category || !form.amount) {
      setErr('Property, category, and amount are required');
      return;
    }
    setSaving(true);
    try {
      const prop = properties.find((p) => p.id === form.property_id);
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: parseFloat(form.amount), property_name: prop?.name }),
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
          <h2 className="font-semibold text-dark">{title}</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-dark">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date *</label>
              <input
                type="date"
                className="input"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Amount (USD) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                required
              />
            </div>
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
          <div>
            <label className="label">Category *</label>
            <select
              className="select"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              required
            >
              <option value="">Select category…</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Vendor</label>
            <input
              type="text"
              className="input"
              placeholder="Vendor or payee"
              value={form.vendor}
              onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
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
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
