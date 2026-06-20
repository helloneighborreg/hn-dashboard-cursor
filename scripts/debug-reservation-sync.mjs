#!/usr/bin/env node
/**
 * Debug one reservation vs linked task(s). Self-contained (no lib imports).
 * Usage: node scripts/debug-reservation-sync.mjs HM29W9SFTR
 */

import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const CODE = (process.argv[2] || '').trim().toUpperCase();
const HOSPITABLE_BASE = process.env.HOSPITABLE_API_BASE || 'https://public.api.hospitable.com/v2';

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

function parseIsoWallClockTime(value) {
	const s = String(value || '').trim();
	if (!s.includes('T')) return null;
	const match = s.match(/T(\d{2}):(\d{2})(?::\d{2})?/);
	return match ? `${match[1]}:${match[2]}` : null;
}

function parseReservationCheckout(reservation) {
	const checkOutRaw = reservation.check_out;
	const departureRaw = reservation.departure_date;
	const fromCheckOut = checkOutRaw ? String(checkOutRaw).slice(0, 10) : null;
	const fromDeparture = departureRaw ? String(departureRaw).slice(0, 10) : null;
	if (!fromCheckOut && !fromDeparture) return { checkoutDate: null, startTime: '10:00' };
	let checkoutDate = fromCheckOut || fromDeparture;
	if (fromCheckOut && fromDeparture) {
		checkoutDate = fromCheckOut >= fromDeparture ? fromCheckOut : fromDeparture;
	}
	const startTime =
		checkOutRaw && (!fromDeparture || checkoutDate === fromCheckOut)
			? parseIsoWallClockTime(checkOutRaw) || '10:00'
			: '10:00';
	return { checkoutDate, startTime };
}

function getReservationCode(r) {
	return r?.code?.trim()?.toUpperCase() || null;
}

async function hospitableRequest(path, params = {}) {
	const token = (process.env.HOSPITABLE_API_TOKEN || '').trim().replace(/^Bearer\s+/i, '');
	const url = new URL(`${HOSPITABLE_BASE}${path}`);
	for (const [k, v] of Object.entries(params)) {
		if (Array.isArray(v)) v.forEach((item) => url.searchParams.append(`${k}[]`, item));
		else if (v != null) url.searchParams.set(k, v);
	}
	const res = await fetch(url, {
		headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
	});
	const text = await res.text();
	if (!res.ok) throw new Error(`Hospitable ${res.status}: ${text.slice(0, 300)}`);
	return JSON.parse(text);
}

async function fetchAllReservations(propertyIds, { startDate, endDate, dateQuery }) {
	const rows = [];
	let page = 1;
	while (page <= 80) {
		const data = await hospitableRequest('/reservations', {
			properties: propertyIds,
			per_page: 100,
			page,
			start_date: startDate,
			end_date: endDate,
			date_query: dateQuery,
			include: 'guest',
		});
		const batch = data.data || [];
		rows.push(...batch);
		if (!batch.length || batch.length < 100) break;
		const lastPage = data.meta?.last_page ?? data.meta?.total_pages;
		if (lastPage && page >= lastPage) break;
		page += 1;
	}
	return rows;
}

loadEnv();

if (!CODE) {
	console.error('Usage: node scripts/debug-reservation-sync.mjs HM29W9SFTR');
	process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
	auth: { persistSession: false },
});

function summarizeReservation(r) {
	const p = parseReservationCheckout(r);
	return {
		code: getReservationCode(r),
		id: r.id,
		status: r.status,
		check_in: r.check_in,
		check_out: r.check_out,
		departure_date: r.departure_date,
		parsedCheckout: p.checkoutDate,
		parsedStart: p.startTime,
		property_id: r.property_id,
	};
}

console.log('=== Debug', CODE, '===\n');

const { data: byCode } = await supabase.from('tasks').select('*').eq('reservation_id', CODE);
const { data: byTitle } = await supabase.from('tasks').select('*').ilike('title', `${CODE}%`);
const tasks = [...new Map([...(byCode || []), ...(byTitle || [])].map((t) => [t.id, t])).values()];

console.log('Tasks in DB:', tasks.length);
tasks.forEach((t) => {
	console.log({
		id: t.id,
		reservation_id: t.reservation_id,
		hospitable_reservation_id: t.hospitable_reservation_id,
		checkout_date: t.checkout_date,
		due_date: t.due_date,
		start_time: t.start_time,
		status: t.status,
		title: t.title,
		updated_at: t.updated_at,
	});
});

const props = (await hospitableRequest('/properties', { per_page: 100, include: 'details' })).data || [];
const propertyIds = props.map((p) => p.id);
console.log('\nProperties:', propertyIds.length);

const found = new Map();
for (const dateQuery of ['checkin', 'checkout']) {
	const rows = await fetchAllReservations(propertyIds, {
		startDate: '2025-01-01',
		endDate: '2027-12-31',
		dateQuery,
	});
	for (const r of rows) {
		if (getReservationCode(r) === CODE) found.set(r.id, { r, dateQuery });
	}
}

console.log('\nAPI list matches:', found.size);
for (const { r, dateQuery } of found.values()) {
	console.log(`  [${dateQuery}]`, summarizeReservation(r));
}

let reservation = [...found.values()][0]?.r;
if (reservation?.id) {
	try {
		const direct = (await hospitableRequest(`/reservations/${reservation.id}`, { include: 'guest' })).data;
		console.log('\nDirect GET:');
		console.log(summarizeReservation(direct || reservation));
		reservation = direct || reservation;
	} catch (e) {
		console.log('\nDirect GET error:', e.message);
	}
}

if (!reservation) {
	console.log('\n✗ Not found in Hospitable list (2025-2027, all properties).');
	process.exit(1);
}

const { checkoutDate, startTime } = parseReservationCheckout(reservation);
const hospitableId = reservation.id;

if (tasks.length && checkoutDate) {
	console.log('\n--- Attempt DB update ---');
	const task = tasks[0];
	const patch = {
		hospitable_reservation_id: hospitableId,
		checkout_date: checkoutDate,
		due_date: checkoutDate,
		start_time: startTime,
		check_in: reservation.check_in,
		updated_at: new Date().toISOString(),
	};
	// only columns that exist
	const safePatch = {
		hospitable_reservation_id: hospitableId,
		checkout_date: checkoutDate,
		due_date: checkoutDate,
		start_time: startTime,
		updated_at: patch.updated_at,
	};
	const { data: updated, error } = await supabase.from('tasks').update(safePatch).eq('id', task.id).select().single();
	if (error) {
		console.log('Update error:', error.message, error.code);
	} else {
		console.log('Updated task:', {
			id: updated.id,
			checkout_date: updated.checkout_date,
			due_date: updated.due_date,
			hospitable_reservation_id: updated.hospitable_reservation_id,
		});
	}
}

console.log('\nExpected checkout:', checkoutDate, 'at', startTime);
if (tasks[0]) {
	console.log('Task had checkout:', tasks[0].checkout_date);
	console.log('Match:', tasks[0].checkout_date === checkoutDate ? 'YES (before patch)' : 'NO — was stale');
}
