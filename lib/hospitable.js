/**
 * Hospitable REST API client
 * Docs: https://developer.hospitable.com
 */

const BASE = process.env.HOSPITABLE_API_BASE || 'https://public.api.hospitable.com/v2';
const TOKEN = process.env.HOSPITABLE_API_TOKEN;

function headers() {
  return {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function request(path, params = {}) {
  if (!TOKEN) throw new Error('HOSPITABLE_API_TOKEN is not set');

  const url = new URL(`${BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (Array.isArray(v)) {
      v.forEach((item) => url.searchParams.append(`${k}[]`, item));
    } else if (v !== undefined && v !== null) {
      url.searchParams.set(k, v);
    }
  });

  const res = await fetch(url.toString(), { headers: headers() });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
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

export async function getReservations(propertyIds, options = {}) {
  if (!propertyIds?.length) return { data: [], meta: {} };

  // The v2 API does not return property_id in the reservations list.
  // We fetch per-property in parallel so we can tag each reservation.
  const settled = await Promise.allSettled(
    propertyIds.map(async (propertyId) => {
      const params = {
        per_page: Math.min(options.perPage || 100, 100),
        page: options.page || 1,
      };
      if (options.status) params.status = options.status;
      if (options.startDate) params.start_date = options.startDate;
      if (options.endDate) params.end_date = options.endDate;
      if (options.include) params.include = options.include;

      const data = await request('/reservations', { properties: [propertyId], ...params });
      return (data.data || []).map((r) => ({ ...r, property_id: propertyId }));
    })
  );

  return {
    data: settled.filter((r) => r.status === 'fulfilled').flatMap((r) => r.value),
    meta: {},
  };
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

// ── Tasks ─────────────────────────────────────────────────────

export async function getHospitableTasks(propertyIds, options = {}) {
  try {
    const params = { properties: propertyIds, per_page: 100 };
    if (options.startDate) params.start_date = options.startDate;
    if (options.endDate) params.end_date = options.endDate;
    const data = await request('/tasks', params);
    return data.data || [];
  } catch {
    return [];
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

export function getAllPropertyIds(properties) {
  return properties.map((p) => p.id);
}

/**
 * Given a list of reservations and properties, attach property name to each.
 * Hospitable /reservations does not include property name in the basic payload;
 * we join by property_id if available, otherwise use a lookup map.
 */
export function attachPropertyNames(reservations, properties) {
  const map = Object.fromEntries(properties.map((p) => [p.id, p]));
  return reservations.map((r) => ({
    ...r,
    property: map[r.property_id] || null,
    property_name: map[r.property_id]?.name || r.property_id || 'Unknown',
  }));
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
