import { withAuth } from '../../../lib/auth';
import { format, addDays } from 'date-fns';
import {
	getProperties,
	getReservations,
	platformLabel,
	buildPropertyMap,
	withReservationPropertyName,
} from '../../../lib/hospitable';
import { filterHiddenPropertyRows, isHiddenPropertyId } from '../../../lib/hiddenProperties';
import { isConfirmedReservation } from '../../../lib/reservationDates';

/** Default window when no check-in filters: 2 years back, 1 year ahead. */
function defaultReservationDateRange() {
	return {
		startDate: format(addDays(new Date(), -730), 'yyyy-MM-dd'),
		endDate: format(addDays(new Date(), 365), 'yyyy-MM-dd'),
	};
}

export default async function handler(req, res) {
  await withAuth(req, res, async (session) => {
    if (req.method !== 'GET') return res.status(405).end();

    const { property, status, start, end, platform } = req.query;

    try {
      if (property && isHiddenPropertyId(property)) {
        return res.json({ data: [], meta: { count: 0 } });
      }

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

      if (status) {
        enriched = enriched.filter(
          (r) => String(r.status || '').toLowerCase() === String(status).toLowerCase(),
        );
      } else {
        enriched = enriched.filter(isConfirmedReservation);
      }

      enriched = filterHiddenPropertyRows(enriched);

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
