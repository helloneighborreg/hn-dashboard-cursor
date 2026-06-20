import { useState } from 'react';
import { X } from 'lucide-react';
import DateInput from './DateInput';
import { fetchJson } from '../lib/apiClient';
import { todayIso } from '../lib/dates';
import { useEscapeKey } from '../lib/useEscapeKey';
import { useFocusTrap } from '../lib/useFocusTrap';
import { BOOKKEEPING_EXPENSE_CATEGORIES } from '../lib/bookkeepingCategories';

/** @deprecated Use BOOKKEEPING_EXPENSE_CATEGORIES from lib/bookkeepingCategories.js */
export const EXPENSE_CATEGORIES = BOOKKEEPING_EXPENSE_CATEGORIES;

export default function ExpenseModal({ properties, onClose, onSaved, title = 'Add Transaction' }) {
  const [form, setForm] = useState({
    date: todayIso(),
    property_id: '',
    category: '',
    vendor: '',
    amount: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  useEscapeKey(onClose);
  const dialogRef = useFocusTrap();

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
      await fetchJson('/api/expenses', {
        method: 'POST',
        body: { ...form, amount: parseFloat(form.amount), property_name: prop?.name },
      });
      onSaved?.();
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="bg-white rounded-2xl shadow-2xl w-full max-w-md focus:outline-none" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-semibold text-dark">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-dark">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date *</label>
              <DateInput
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
              {BOOKKEEPING_EXPENSE_CATEGORIES.map((c) => (
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
