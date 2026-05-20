import { withAuth } from '../../../lib/auth';
import { getProperties, getReservations } from '../../../lib/hospitable';
import { upsertTurnoverTask } from '../../../lib/db';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

export default async function handler(req, res) {
  await withAuth(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).end();
    try {
      const properties = await getProperties();
      const propMap = Object.fromEntries(properties.map((p) => [p.id, p]));
      const ids = properties.map((p) => p.id);

      const { data: reservations } = await getReservations(ids, {
        perPage: 200,
        startDate: format(new Date(), 'yyyy-MM-dd'),
      });

      let created = 0, skipped = 0;

      for (const r of reservations) {
        if (r.status === 'cancelled' || r.status === 'declined') { skipped++; continue; }
        const checkoutDate = r.departure_date?.slice(0, 10) || r.check_out?.slice(0, 10);
        if (!checkoutDate) { skipped++; continue; }

        const prop = propMap[r.property_id];
        const { isNew } = await upsertTurnoverTask({
          id: uuidv4(),
          reservation_id: r.id,
          property_id: r.property_id,
          property_name: prop?.name || r.property_id,
          title: `Turnover – ${prop?.name || 'Property'} – ${checkoutDate}`,
          description: `Guest checkout 10:00 AM · Turnover due 4:00 PM\nCode: ${r.code} · Platform: ${r.platform}`,
          due_date: checkoutDate,
          due_time: '16:00',
          checkout_date: checkoutDate,
          status: 'unassigned',
          assignee: null,
          type: 'turnover',
          notes: null,
        });
        if (isNew) created++;
        else skipped++;
      }

      res.json({ ok: true, processed: reservations.length, created, skipped });
    } catch (err) {
      console.error('Task sync error:', err.message);
      res.status(502).json({ error: err.message });
    }
  });
}
