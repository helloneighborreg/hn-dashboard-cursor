import { withAuth } from '../../../lib/auth';
import { getProperty, getPropertyImages } from '../../../lib/hospitable';

export default async function handler(req, res) {
  await withAuth(req, res, async () => {
    if (req.method !== 'GET') return res.status(405).end();
    const { id } = req.query;
    try {
      const [property, images] = await Promise.all([
        getProperty(id),
        getPropertyImages(id),
      ]);
      res.json({ data: { ...property, images } });
    } catch (err) {
      console.error('Property detail error:', err.message);
      res.status(502).json({ error: err.message });
    }
  }, { adminOnly: true });
}
