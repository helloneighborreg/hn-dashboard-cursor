import { withAuth } from '../../../lib/auth';
import { getProperties, getReservations, getPropertyCalendar } from '../../../lib/hospitable';

export default async function handler(req, res) {
  await withAuth(req, res, async () => {
    if (req.method !== 'GET') return res.status(405).end();

    const { start, end } = req.query;

    try {
      const properties = await getProperties();
      const ids = properties.map((p) => p.id);

      // Fetch from 365 days before the visible window so long-term stays that
      // checked in months ago (e.g. manual reservations) are included.
      // The calendar page already filters bars to only render within the window.
      const fetchFrom = start
        ? new Date(new Date(start).getTime() - 365 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10)
        : undefined;

      const { data: reservations } = await getReservations(ids, {
        perPage: 200,
        startDate: fetchFrom,
        endDate: end,
        include: 'guest',
      });

      const active = reservations.filter(
        (r) => r.status !== 'cancelled' && r.status !== 'declined'
      );

      // Fetch day-by-day availability for the visible window (for blocked day shading).
      // Only covers the actual display range (start→end), not the extended lookback.
      const calResults = await Promise.allSettled(
        properties.map(async (p) => {
          const days = await getPropertyCalendar(p.id, { start, end });
          return { id: p.id, days };
        })
      );

      // Build availability map: { [propertyId]: { [dateStr]: { available, reason } } }
      const availability = {};
      calResults.forEach((result) => {
        if (result.status !== 'fulfilled') return;
        const { id, days } = result.value;
        availability[id] = {};
        if (days.length > 0) {
          console.log('Calendar day sample:', JSON.stringify(days[0]));
        }
        (Array.isArray(days) ? days : []).forEach((day) => {
          if (!day || !day.date) return;
          // Hospitable may nest availability under day.status or directly on day
          const available =
            day.status?.available ?? day.available ?? true;
          const reason =
            day.status?.reason ?? day.reason ?? null;
          availability[id][day.date] = { available, reason };
        });
      });

      res.json({ data: { properties, reservations: active, availability } });
    } catch (err) {
      console.error('Calendar API error:', err.message);
      res.status(502).json({ error: err.message });
    }
  });
}
