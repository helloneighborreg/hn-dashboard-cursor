import { withAuth } from '../../../lib/auth';
import { format, addDays } from 'date-fns';
import {
	getProperties,
	getReservations,
	platformLabel,
	buildPropertyMap,
	withReservationPropertyName,
} from '../../../lib/hospitable';

/** Default window when no check-in filters: 2 years back, 1 year ahead. */
function defaultReservationDateRange() {
	return {
		startDate: format(addDays(new Date(), -730), 'yyyy-MM-dd'),
		endDate: format(addDays(new Date(), 365), 'yyyy-MM-dd'),
	};
}

export default async function handler(req, res) {
  await withAuth(req, res, async () => {
    if (req.method !== 'GET') return res.status(405).end();

    const { property, status, start, end, platform } = req.query;

    try {
      const properties = await getProperties();
      const propertyMap = buildPropertyMap(properties);

      const ids = property ? [property] : properties.map((p) => p.id);

      const defaults = defaultReservationDateRange();
      const opts = {
        perPage: 100,
        include: 'guest',
        startDate: start || defaults.startDate,
        endDate: end || defaults.endDate,
      };
      if (status) opts.status = status;

      const { data: reservations } = await getReservations(ids, opts);

      // Attach property info; filter by platform client-side
      let enriched = reservations.map((r) => {
        const row = withReservationPropertyName(r, propertyMap);
        const prop = propertyMap[row.property_id] || row.property || null;
        return {
          ...row,
          property_public_name: prop?.public_name || '',
          platform_label: platformLabel(r.platform),
        };
      });

      if (platform) {
        enriched = enriched.filter((r) => r.platform === platform);
      }

      res.json({
        data: enriched,
        meta: {
          count: enriched.length,
          date_from: opts.startDate,
          date_to: opts.endDate,
        },
      });
    } catch (err) {
      console.error('Reservations API error:', err.message);
      res.status(502).json({ error: err.message });
    }
  });
}
