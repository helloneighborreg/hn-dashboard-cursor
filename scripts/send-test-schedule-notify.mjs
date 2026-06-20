#!/usr/bin/env node
/**
 * Send a sample task-reschedule notification email (for testing templates).
 * Usage: node scripts/send-test-schedule-notify.mjs [email]
 */

import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { format } from 'date-fns';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadEnv() {
	for (const file of ['env.local', '.env.local', '.env']) {
		const p = path.join(root, file);
		if (!existsSync(p)) continue;
		for (const line of readFileSync(p, 'utf-8').split('\n')) {
			const t = line.trim();
			if (!t || t.startsWith('#')) continue;
			const eq = t.indexOf('=');
			if (eq === -1) continue;
			const key = t.slice(0, eq).trim();
			let val = t.slice(eq + 1).trim();
			if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
				val = val.slice(1, -1);
			}
			if (!process.env[key]) process.env[key] = val;
		}
		break;
	}
}

function adminEmail() {
	const raw = process.env.DASHBOARD_USERS?.trim();
	if (!raw) return null;
	try {
		const users = JSON.parse(raw);
		const admin = users.find((u) => u.role === 'admin' && u.email);
		return admin?.email?.trim() || null;
	} catch {
		return null;
	}
}

function formatDateShort(dateStr) {
	if (!dateStr) return '—';
	const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
	if (!y || !m || !d) return String(dateStr);
	return format(new Date(y, m - 1, d), 'MM-dd-yyyy');
}

function formatClock(timeStr) {
	const value = timeStr || '10:00';
	const [h, m] = value.split(':').map(Number);
	if (Number.isNaN(h)) return value;
	const d = new Date();
	d.setHours(h, m || 0, 0, 0);
	return format(d, 'h:mm a');
}

function formatCheckoutSchedule(task) {
	return `${formatDateShort(task?.checkout_date || task?.due_date)} at ${formatClock(task?.start_time || '10:00')}`;
}

function formatDueSchedule(task) {
	return `${formatDateShort(task?.due_date)} at ${formatClock(task?.due_time || '16:00')}`;
}

function getBookingChanges(before, after) {
	const changes = [];
	const checkoutBefore = formatCheckoutSchedule(before);
	const checkoutAfter = formatCheckoutSchedule(after);
	if (checkoutBefore !== checkoutAfter) {
		changes.push({ label: 'Checkout', before: checkoutBefore, after: checkoutAfter });
	}
	const dueBefore = formatDueSchedule(before);
	const dueAfter = formatDueSchedule(after);
	if (dueBefore !== dueAfter) {
		changes.push({ label: 'Due', before: dueBefore, after: dueAfter });
	}
	return changes;
}

function formatChangeLine(change) {
	return `${change.label}: was ${change.before}, now ${change.after}`;
}

function escapeHtml(value) {
	return String(value || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function buildMessages(task, previousTask) {
	const changes = getBookingChanges(previousTask, task);
	const changeItems = changes.map((change) => [
		'<li>',
		`<strong>${escapeHtml(change.label)}:</strong> `,
		`<del style="color:#6b7280">${escapeHtml(change.before)}</del> `,
		'→ ',
		`<strong style="color:#15803d">${escapeHtml(change.after)}</strong>`,
		'</li>',
	].join(''));

	const text = [
		'Hello Neighbor — task schedule updated',
		'',
		task.title,
		`Property: ${task.property_name || '—'}`,
		`Guest: ${task.guest_name || '—'}`,
		'',
		'What changed:',
		...changes.map((c) => `• ${formatChangeLine(c)}`),
		'',
		'Current schedule:',
		`Checkout: ${formatCheckoutSchedule(task)}`,
		`Due: ${formatDueSchedule(task)}`,
	].join('\n');

	const html = [
		'<p>Hello Neighbor — task schedule updated</p>',
		`<p><strong>${escapeHtml(task.title)}</strong></p>`,
		`<p>Property: ${escapeHtml(task.property_name || '—')}</p>`,
		`<p>Guest: ${escapeHtml(task.guest_name || '—')}</p>`,
		'<p><strong>What changed:</strong></p>',
		`<ul style="margin:0 0 1em;padding-left:1.25em">${changeItems.join('')}</ul>`,
		'<p><strong>Current schedule:</strong></p>',
		`<p>Checkout: ${escapeHtml(formatCheckoutSchedule(task))}</p>`,
		`<p>Due: ${escapeHtml(formatDueSchedule(task))}</p>`,
	].join('\n');

	return { text, html, subject: `Task rescheduled: ${task.title}` };
}

async function sendEmail(to, subject, { text, html }) {
	const apiKey = process.env.RESEND_API_KEY;
	const from = process.env.TASK_NOTIFY_FROM_EMAIL;
	if (!apiKey || !from) {
		throw new Error('Set RESEND_API_KEY and TASK_NOTIFY_FROM_EMAIL in env.local');
	}

	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ from, to: [to], subject, text, html }),
	});

	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new Error(`Resend failed (${res.status}): ${body.slice(0, 300)}`);
	}

	return res.json();
}

loadEnv();

const to = process.argv[2]?.trim() || adminEmail();
if (!to) {
	console.error('Usage: node scripts/send-test-schedule-notify.mjs you@example.com');
	process.exit(1);
}

const previousTask = {
	title: 'HMS2MZJJTM - Cascades | 8303 | Baker',
	property_name: 'Cascades | 8303 | Baker',
	guest_name: 'Laz Powell',
	checkout_date: '2026-06-01',
	due_date: '2026-06-01',
	start_time: '10:00',
	due_time: '16:00',
};

const task = {
	...previousTask,
	checkout_date: '2026-06-03',
	due_date: '2026-06-03',
};

const { text, html, subject } = buildMessages(task, previousTask);
const result = await sendEmail(to, `[TEST] ${subject}`, { text, html });
console.log(`Sent test notification to ${to}`);
console.log(JSON.stringify(result, null, 2));
