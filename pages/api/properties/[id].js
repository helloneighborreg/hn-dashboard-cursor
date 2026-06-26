import { withAuth } from '../../../lib/auth';
import { getProperty, getPropertyImages } from '../../../lib/hospitable';
import { rejectHiddenProperty } from '../../../lib/hiddenProperties';

export default async function handler(req, res) {
  await withAuth(req, res, async () => {
    if (req.method !== 'GET') return res.status(405).end();
    const { id } = req.query;
    if (rejectHiddenProperty(id, res)) return;
    try {
      const [property, images] = await Promise.all([
        getProperty(id),
        getPropertyImages(id),
      ]);
      res.json({ data: { ...property, images } });
    } catch (err) {
      console.error('Property detail error:', err.message);
      const status = /not found/i.test(err.message) ? 404 : 502;
      res.status(status).json({ error: err.message });
    }
  });
}
