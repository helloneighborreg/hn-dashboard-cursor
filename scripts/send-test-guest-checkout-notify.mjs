#!/usr/bin/env node
/**
 * Send a sample guest-checkout notification email (for testing templates).
 * Usage: node scripts/send-test-guest-checkout-notify.mjs [email]
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

function brandiEmail() {
	const raw = process.env.DASHBOARD_USERS?.trim();
	if (!raw) return process.env.BRANDI_EMAIL?.trim() || null;
	try {
		const users = JSON.parse(raw);
		const brandi = users.find((u) => String(u.username).toLowerCase() === 'brandi');
		return brandi?.email?.trim() || process.env.BRANDI_EMAIL?.trim() || null;
	} catch {
		return process.env.BRANDI_EMAIL?.trim() || null;
	}
}

function formatDateShort(dateStr) {
	if (!dateStr) return '—';
	const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
	if (!y || !m || !d) return String(dateStr);
	return format(new Date(y, m - 1, d), 'MM-dd-yyyy');
}

function escapeHtml(value) {
	return String(value || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function buildMessages(checkout, task, cleanerName) {
	const property = checkout.property_name || task?.property_name || '—';
	const guest = checkout.guest_name || task?.guest_name || task?.description || '—';
	const checkoutDate = formatDateShort(checkout.checkout_date || task?.checkout_date || task?.due_date);

	const lines = [
		'Hello Neighbor — guest checked out',
		'',
		`Property: ${property}`,
		`Guest: ${guest}`,
		`Checkout date: ${checkoutDate}`,
	];

	if (cleanerName) {
		lines.push('', `Primary cleaner: ${cleanerName}`);
	}

	lines.push('', 'The guest confirmed checkout. You can begin cleaning when ready.');

	const blocks = [
		'<p>Hello Neighbor — guest checked out</p>',
		`<p><strong>${escapeHtml(property)}</strong></p>`,
		`<p>Guest: ${escapeHtml(guest)}</p>`,
		`<p>Checkout date: ${escapeHtml(checkoutDate)}</p>`,
	];

	if (cleanerName) {
		blocks.push(`<p>Primary cleaner: ${escapeHtml(cleanerName)}</p>`);
	}

	blocks.push('<p>The guest confirmed checkout. You can begin cleaning when ready.</p>');

	return {
		subject: `Guest checked out: ${property}`,
		text: lines.join('\n'),
		html: blocks.join('\n'),
	};
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

const to = process.argv[2]?.trim() || brandiEmail();
if (!to) {
	console.error('Usage: node scripts/send-test-guest-checkout-notify.mjs brandi@example.com');
	process.exit(1);
}

const checkout = {
	property_name: 'Cascades | 8303 | Baker',
	guest_name: 'Sample Guest',
	checkout_date: new Date().toISOString().slice(0, 10),
};

const task = {
	property_name: checkout.property_name,
	guest_name: checkout.guest_name,
	checkout_date: checkout.checkout_date,
};

const cleanerName = 'Brandi Drieslein';
const { text, html, subject } = buildMessages(checkout, task, cleanerName);
const result = await sendEmail(to, `[TEST] ${subject}`, { text, html });
console.log(`Sent guest checkout test notification to ${to}`);
console.log(JSON.stringify(result, null, 2));
