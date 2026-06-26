import { withAuth } from '../../../../lib/auth';
import { getSupplyMarkupPercent, setSupplyMarkupPercent } from '../../../../lib/supplyMarkupDb';

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		if (req.method === 'GET') {
			try {
				const percent = await getSupplyMarkupPercent();
				res.json({ data: { percent } });
			} catch (err) {
				console.error('Supply markup GET error:', err.message);
				res.status(500).json({ error: err.message });
			}
			return;
		}

		if (req.method === 'PUT') {
			try {
				const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
				const percent = await setSupplyMarkupPercent(body?.percent);
				res.json({ data: { percent } });
			} catch (err) {
				console.error('Supply markup PUT error:', err.message);
				res.status(500).json({ error: err.message });
			}
			return;
		}

		res.status(405).end();
	});
}
