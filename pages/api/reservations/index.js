import { withAuth } from '../../../lib/auth';
import {
	getProperties,
	getReservations,
	getPropertyCode,
	platformLabel,
	buildPropertyMap,
} from '../../../lib/hospitable';

export default async function handler(req, res) {
  await withAuth(req, res, async () => {
    if (req.method !== 'GET') return res.status(405).end();

    const { property, status, start, end, platform, page = '1' } = req.query;

    try {
      const properties = await getProperties();
      const propertyMap = buildPropertyMap(properties);

      const ids = property ? [property] : properties.map((p) => p.id);

      const opts = {
        page: parseInt(page, 10),
        perPage: 50,
        include: 'guest',
      };
      if (status) opts.status = status;
      if (start) opts.startDate = start;
      if (end) opts.endDate = end;

      const { data: reservations, meta } = await getReservations(ids, opts);

      // Attach property info; filter by platform client-side
      let enriched = reservations.map((r) => {
        const prop = propertyMap[r.property_id] || null;
        return {
          ...r,
          property_name: getPropertyCode(prop) || r.property_id || 'Unknown',
          property_public_name: prop?.public_name || '',
          platform_label: platformLabel(r.platform),
        };
      });

      if (platform) {
        enriched = enriched.filter((r) => r.platform === platform);
      }

      res.json({ data: enriched, meta });
    } catch (err) {
      console.error('Reservations API error:', err.message);
      res.status(502).json({ error: err.message });
    }
  });
}
