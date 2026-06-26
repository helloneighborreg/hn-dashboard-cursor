import { withAuth } from '../../../../lib/auth';
import {
	deleteSupplyInventoryLocation,
	getSupplyInventory,
	renameSupplyInventoryLocation,
} from '../../../../lib/suppliesDb';

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		if (req.method === 'GET') {
			const rows = await getSupplyInventory();
			const locations = [...new Set(rows.map((row) => row.location).filter(Boolean))].sort();
			return res.json({ data: locations });
		}

		if (req.method === 'PATCH') {
			const { from, to } = req.body;
			if (!from?.trim() || !to?.trim()) {
				return res.status(400).json({ error: 'from and to are required' });
			}
			await renameSupplyInventoryLocation(from, to);
			return res.json({ ok: true });
		}

		if (req.method === 'DELETE') {
			const { location } = req.body;
			if (!location?.trim()) {
				return res.status(400).json({ error: 'location is required' });
			}
			await deleteSupplyInventoryLocation(location);
			return res.json({ ok: true });
		}

		res.status(405).end();
	}, { adminOnly: true });
}
