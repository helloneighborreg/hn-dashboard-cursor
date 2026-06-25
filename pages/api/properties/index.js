import { withAuth } from '../../../lib/auth';
import { getProperties } from '../../../lib/hospitable';

export default async function handler(req, res) {
  await withAuth(req, res, async () => {
    if (req.method !== 'GET') return res.status(405).end();
    try {
      const properties = await getProperties({ include: 'details,listings' });
      res.json({ data: properties });
    } catch (err) {
      console.error('Properties API error:', err.message);
      res.status(502).json({ error: err.message });
    }
  });
}
