/**
 * Simple JSON-file store for tasks and expenses.
 * No native modules — works on macOS, Linux, and all hosting providers.
 * Data is stored in ./data/db.json (auto-created on first run).
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH  = path.join(DATA_DIR, 'db.json');

const DEFAULT = () => ({ tasks: [], expenses: [] });

function read() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) { write(DEFAULT()); return DEFAULT(); }
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')); }
  catch { return DEFAULT(); }
}

function write(data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function now() { return new Date().toISOString(); }

// ── Tasks ─────────────────────────────────────────────────────

export function createTask(task) {
  const db = read();
  const record = { ...task, created_at: now(), updated_at: now() };
  db.tasks.push(record);
  write(db);
  return record;
}

export function upsertTurnoverTask(task) {
  const db = read();
  const existing = db.tasks.find(
    (t) => t.reservation_id === task.reservation_id && t.type === 'turnover'
  );
  if (existing) return existing;
  return createTask(task);
}

export function getTasks(filters = {}) {
  const db = read();
  let tasks = [...db.tasks];

  if (filters.property_id) tasks = tasks.filter((t) => t.property_id === filters.property_id);
  if (filters.status)      tasks = tasks.filter((t) => t.status === filters.status);
  if (filters.assignee)    tasks = tasks.filter((t) => t.assignee === filters.assignee);
  if (filters.due_date)    tasks = tasks.filter((t) => t.due_date === filters.due_date);
  if (filters.date_from)   tasks = tasks.filter((t) => t.due_date >= filters.date_from);
  if (filters.date_to)     tasks = tasks.filter((t) => t.due_date <= filters.date_to);
  if (filters.type)        tasks = tasks.filter((t) => t.type === filters.type);

  return tasks.sort((a, b) =>
    a.due_date !== b.due_date
      ? a.due_date.localeCompare(b.due_date)
      : (a.due_time || '').localeCompare(b.due_time || '')
  );
}

export function getTaskById(id) {
  return read().tasks.find((t) => t.id === id) || null;
}

export function updateTask(id, updates) {
  const db = read();
  const idx = db.tasks.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const allowed = ['status', 'assignee', 'notes', 'due_date', 'due_time', 'title', 'description'];
  allowed.forEach((k) => { if (updates[k] !== undefined) db.tasks[idx][k] = updates[k]; });
  db.tasks[idx].updated_at = now();
  write(db);
  return db.tasks[idx];
}

export function deleteTask(id) {
  const db = read();
  db.tasks = db.tasks.filter((t) => t.id !== id);
  write(db);
}

export function getTasksForToday() {
  return getTasks({ due_date: new Date().toISOString().slice(0, 10) });
}

// ── Expenses ──────────────────────────────────────────────────

export function createExpense(expense) {
  const db = read();
  const record = { ...expense, created_at: now() };
  db.expenses.push(record);
  write(db);
  return record;
}

export function getExpenses(filters = {}) {
  const db = read();
  let expenses = [...db.expenses];

  if (filters.property_id) expenses = expenses.filter((e) => e.property_id === filters.property_id);
  if (filters.date_from)   expenses = expenses.filter((e) => e.date >= filters.date_from);
  if (filters.date_to)     expenses = expenses.filter((e) => e.date <= filters.date_to);
  if (filters.category)    expenses = expenses.filter((e) => e.category === filters.category);

  return expenses.sort((a, b) => b.date.localeCompare(a.date));
}

export function getExpenseById(id) {
  return read().expenses.find((e) => e.id === id) || null;
}

export function updateExpense(id, updates) {
  const db = read();
  const idx = db.expenses.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  const allowed = ['date', 'property_id', 'property_name', 'category', 'vendor', 'amount', 'notes', 'receipt_url'];
  allowed.forEach((k) => { if (updates[k] !== undefined) db.expenses[idx][k] = updates[k]; });
  write(db);
  return db.expenses[idx];
}

export function deleteExpense(id) {
  const db = read();
  db.expenses = db.expenses.filter((e) => e.id !== id);
  write(db);
}
