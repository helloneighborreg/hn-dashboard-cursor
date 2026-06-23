/**
 * Hospitable REST API client
 * Docs: https://developer.hospitable.com
 */

import { format, addDays } from 'date-fns';
import { getPropertyCode, getPropertyDisplayName } from './codes';
import { fetchWithRetry } from './httpFetch';
import { reservationActsAsCancelled } from './reservationDates.js';

export { getPropertyCode, getPropertyDisplayName, getReservationCode } from './codes';

const BASE = process.env.HOSPITABLE_API_BASE || 'https://public.api.hospitable.com/v2';

function getToken() {
	let t = (process.env.HOSPITABLE_API_TOKEN || '').trim();
	if (t.startsWith('Bearer ')) t = t.slice(7).trim();
	if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
		t = t.slice(1, -1).trim();
	}
	return t;
}

function headers() {
	const token = getToken();
	return {
		Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function request(path, params = {}) {
	const token = getToken();
	if (!token) {
		throw new Error(
			'HOSPITABLE_API_TOKEN is not set. Add it in Vercel → Settings → Environment Variables (Production), then Redeploy.',
		);
	}

  const url = new URL(`${BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (Array.isArray(v)) {
      v.forEach((item) => url.searchParams.append(`${k}[]`, item));
    } else if (v !== undefined && v !== null) {
      url.searchParams.set(k, v);
    }
  });

  const res = await fetchWithRetry(url.toString(), { headers: headers() });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 401) {
      throw new Error(
        'Hospitable API: Unauthenticated. In Vercel, set HOSPITABLE_API_TOKEN to a valid Personal Access Token from Hospitable → Settings → API access, then Redeploy.',
      );
    }
    throw new Error(`Hospitable API ${res.status}: ${path} — ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ── Properties ───────────────────────────────────────────────

export async function getProperties({ include = 'details' } = {}) {
  const data = await request('/properties', { per_page: 100, include });
  return data.data || [];
}

export async function getProperty(id) {
  const data = await request(`/properties/${id}`, { include: 'details,listings' });
  return data.data || data;
}

export async function getPropertyImages(id) {
  try {
    const data = await request(`/properties/${id}/images`);
    return data.data || [];
  } catch {
    return [];
  }
}

export async function getPropertyCalendar(id, { start, end } = {}) {
  try {
    const params = {};
    if (start) params.start_date = start;
    if (end) params.end_date = end;
    const data = await request(`/properties/${id}/calendar`, params);
    // Hospitable may return days at different paths depending on API version.
    // Try each in order: data.data[], data.data.days[], data.days[], data[] itself.
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.data?.days)) return data.data.days;
    if (Array.isArray(data.days)) return data.days;
    if (Array.isArray(data)) return data;
    // Non-array response — log the keys so we can debug the shape
    console.warn('getPropertyCalendar unexpected shape for', id, '— keys:', JSON.stringify(Object.keys(data || {})));
    return [];
  } catch (err) {
    console.error('getPropertyCalendar error for', id, ':', err.message);
    return [];
  }
}

// ── Reservations ─────────────────────────────────────────────

function reservationNestedProperty(reservation) {
	const p = reservation?.property || reservation?.properties;
	if (Array.isArray(p)) return p[0] || null;
	return p || null;
}

export function reservationPropertyId(reservation, fallbackPropertyId) {
	return (
		reservation?.property_id ||
		reservationNestedProperty(reservation)?.id ||
		reservation?.listing?.property_id ||
		fallbackPropertyId ||
		null
	);
}

export function reservationPropertyRecord(reservation, propMap = {}) {
	const propertyId = reservationPropertyId(reservation);
	return propMap[propertyId] || reservationNestedProperty(reservation) || reservation?.property || null;
}

function normalizeReservationRow(reservation, fallbackPropertyId) {
	const nestedProperty = reservationNestedProperty(reservation);
	const property_id = reservationPropertyId(reservation, fallbackPropertyId);
	return {
		...reservation,
		property_id,
		property: nestedProperty || reservation?.property || null,
	};
}

function reservationInclude(options = {}) {
	const parts = new Set(['guest', 'properties']);
	if (options.include) {
		for (const part of options.include.split(',')) {
			const trimmed = part.trim();
			if (trimmed) parts.add(trimmed);
		}
	}
	return [...parts].join(',');
}

async function fetchReservationsPaginated(propertyIds, options = {}) {
	const perPage = Math.min(options.perPage || 100, 100);
	const maxPages = options.maxPages ?? 50;
	let page = options.page || 1;
	const rows = [];
	const fallbackPropertyId = propertyIds.length === 1 ? propertyIds[0] : null;

	while (page <= maxPages) {
		const params = {
			per_page: perPage,
			page,
			properties: propertyIds,
			date_query: options.dateQuery || 'checkin',
			include: reservationInclude(options),
		};
		if (options.status) params.status = options.status;
		if (options.startDate) params.start_date = options.startDate;
		if (options.endDate) params.end_date = options.endDate;

		const data = await request('/reservations', params);
		const batch = (data.data || []).map((r) => normalizeReservationRow(r, fallbackPropertyId));
		rows.push(...batch);

		const meta = data.meta || {};
		const lastPage = meta.last_page ?? meta.total_pages;
		if (!batch.length || batch.length < perPage) break;
		if (lastPage && page >= lastPage) break;
		page += 1;
	}

	return rows;
}

export async function getReservations(propertyIds, options = {}) {
	if (!propertyIds?.length) return { data: [], meta: {} };

	try {
		const data = await fetchReservationsPaginated(propertyIds, options);
		return { data, meta: {} };
	} catch (bulkErr) {
		if (options.perPropertyFallback === false) throw bulkErr;
		// Fallback when bulk request fails (e.g. URL too long with many property IDs).
		console.warn('Bulk reservation fetch failed, falling back per-property:', bulkErr.message);
		const settled = await Promise.allSettled(
			propertyIds.map((propertyId) =>
				fetchReservationsPaginated([propertyId], options).then((rows) =>
					rows.map((r) => normalizeReservationRow(r, propertyId)),
				),
			),
		);

		const failed = settled.filter((r) => r.status === 'rejected');
		if (failed.length) {
			console.warn(
				`getReservations: ${failed.length}/${propertyIds.length} properties failed`,
				failed[0]?.reason?.message,
			);
		}

		return {
			data: settled.filter((r) => r.status === 'fulfilled').flatMap((r) => r.value),
			meta: {},
		};
	}
}

export async function getReservation(id) {
  const data = await request(`/reservations/${id}`, { include: 'guest,property,financial' });
  return data.data || data;
}

export async function getReservationMessages(id) {
  try {
    const data = await request(`/reservations/${id}/messages`);
    return data.data || [];
  } catch {
    return [];
  }
}

// ── Financial ────────────────────────────────────────────────

export async function getPayouts(options = {}) {
  const params = { per_page: 200, page: 1 };
  if (options.startDate) params.start_date = options.startDate;
  if (options.endDate) params.end_date = options.endDate;
  try {
    const data = await request('/payouts', params);
    return { data: data.data || [], meta: data.meta || {} };
  } catch {
    return { data: [], meta: {} };
  }
}

export async function getTransactions(options = {}) {
  const params = { per_page: 200 };
  if (options.propertyId) params.property_id = options.propertyId;
  try {
    const data = await request('/transactions', params);
    return { data: data.data || [], meta: data.meta || {} };
  } catch {
    return { data: [], meta: {} };
  }
}

// ── Inquiries / Guests ────────────────────────────────────────

export async function getInquiries(options = {}) {
  try {
    const params = { per_page: 50 };
    const data = await request('/inquiries', params);
    return data.data || [];
  } catch {
    return [];
  }
}

// ── Helpers ───────────────────────────────────────────────────

export function buildPropertyMap(properties) {
	return Object.fromEntries(properties.map((p) => [p.id, p]));
}

export function reservationCheckIn(reservation) {
	return (reservation?.check_in || reservation?.arrival_date || '').slice(0, 10);
}

export function reservationCheckOut(reservation) {
	return (reservation?.check_out || reservation?.departure_date || '').slice(0, 10);
}

export function isActiveReservation(reservation) {
	return !reservationActsAsCancelled(reservation);
}

export function withReservationPropertyName(reservation, propMap) {
	const propertyId = reservationPropertyId(reservation);
	const prop = reservationPropertyRecord(reservation, propMap);
	return {
		...reservation,
		property_id: propertyId,
		property_name: getPropertyDisplayName(prop)
			|| getPropertyDisplayName(reservationNestedProperty(reservation))
			|| getPropertyCode(prop)
			|| getPropertyCode(reservationNestedProperty(reservation))
			|| propertyId
			|| 'Unknown',
	};
}

function mergeReservationsById(rows) {
	const byId = new Map();
	for (const row of rows) {
		if (row?.id) byId.set(row.id, row);
	}
	return [...byId.values()];
}

/**
 * Fetch reservations for task sync.
 * Uses checkout date only (turnover tasks) and caps pages to stay under Cloudflare Workers
 * subrequest limits (~50 on free, higher on paid). Use POST /api/tasks/sync-reservation?code=…
 * for a single booking outside this window.
 */
export async function fetchReservationsForSync({
	lookbackDays = 60,
	lookaheadDays = 180,
	maxPages = 20,
} = {}) {
	const properties = await getProperties();
	const propMap = buildPropertyMap(properties);
	const ids = properties.map((p) => p.id);
	const fetchFrom = format(addDays(new Date(), -lookbackDays), 'yyyy-MM-dd');
	const fetchTo = format(addDays(new Date(), lookaheadDays), 'yyyy-MM-dd');

	const { data: byCheckout } = await getReservations(ids, {
		perPage: 100,
		maxPages,
		startDate: fetchFrom,
		endDate: fetchTo,
		include: 'guest',
		dateQuery: 'checkout',
		perPropertyFallback: false,
	});

	const reservations = mergeReservationsById(byCheckout || []);

	return { properties, propMap, reservations };
}

export function getAllPropertyIds(properties) {
  return properties.map((p) => p.id);
}

/**
 * Given a list of reservations and properties, attach property name to each.
 * Hospitable /reservations does not include property name in the basic payload;
 * we join by property_id if available, otherwise use a lookup map.
 */
export function attachPropertyNames(reservations, properties) {
  const map = buildPropertyMap(properties);
  return reservations.map((r) => withReservationPropertyName(r, map));
}

/** Format a platform name for display */
export function platformLabel(platform) {
  const labels = {
    airbnb: 'Airbnb',
    homeaway: 'VRBO',
    vrbo: 'VRBO',
    booking_com: 'Booking.com',
    direct: 'Direct',
    hospitable: 'Direct',
  };
  return labels[platform] || platform;
}
