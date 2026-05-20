import { withAuth } from '../../../lib/auth';
import { getProperties, getReservations } from '../../../lib/hospitable';
import { getTasksForToday } from '../../../lib/db';
import { format, addDays } from 'date-fns';

export default async function handler(req, res) {
  await withAuth(req, res, async () => {
    if (req.method !== 'GET') return res.status(405).end();
    try {
      const properties = await getProperties();
      const propMap = Object.fromEntries(properties.map((p) => [p.id, p]));
      const ids = properties.map((p) => p.id);

      const todayStr  = format(new Date(), 'yyyy-MM-dd');
      const in7days   = format(addDays(new Date(), 7), 'yyyy-MM-dd');
      // Fetch from 90 days back so in-progress long-term stays are included
      const fetchFrom = format(addDays(new Date(), -90), 'yyyy-MM-dd');

      const { data: all } = await getReservations(ids, {
        perPage: 200,
        startDate: fetchFrom,
        endDate: in7days,
        include: 'guest',
      });
      const active = all.filter((r) => r.status !== 'cancelled' && r.status !== 'declined');
      const wp = (r) => ({ ...r, property_name: propMap[r.property_id]?.name || r.property_id });

      const ci = (r) => (r.check_in  || r.arrival_date  || '').slice(0, 10);
      const co = (r) => (r.check_out || r.departure_date || '').slice(0, 10);

      const occupied          = active.filter((r) => ci(r) <= todayStr && co(r) > todayStr).map(wp);
      const checkInsToday     = active.filter((r) => ci(r) === todayStr).map(wp);
      const checkOutsToday    = active.filter((r) => co(r) === todayStr).map(wp);
      const upcomingCheckIns  = active.filter((r) => ci(r) > todayStr && ci(r) <= in7days).map(wp);
      const upcomingCheckOuts = active.filter((r) => co(r) > todayStr && co(r) <= in7days).map(wp);

      const todayTasks = getTasksForToday();

      res.json({
        data: {
          today: todayStr,
          properties_count: properties.length,
          occupied, checkInsToday, checkOutsToday,
          check_ins_today: checkInsToday,
          check_outs_today: checkOutsToday,
          upcoming_check_ins: upcomingCheckIns,
          upcoming_check_outs: upcomingCheckOuts,
          tasks_today: todayTasks,
          stats: {
            occupied_count: occupied.length,
            checkins_today: checkInsToday.length,
            checkouts_today: checkOutsToday.length,
            tasks_today: todayTasks.length,
            upcoming_checkins: upcomingCheckIns.length,
            upcoming_checkouts: upcomingCheckOuts.length,
          },
        },
      });
    } catch (err) {
      console.error('Dashboard error:', err.message);
      res.status(502).json({ error: err.message });
    }
  });
}
