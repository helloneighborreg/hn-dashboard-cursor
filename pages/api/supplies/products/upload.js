import { withAuth } from '../../../../lib/auth';
import { uploadSupplyProductImage } from '../../../../lib/suppliesStorage';

export const config = {
	api: {
		bodyParser: {
			sizeLimit: '8mb',
		},
	},
};

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		if (req.method !== 'POST') {
			res.status(405).end();
			return;
		}
		const { base64, contentType, filename, product_id } = req.body || {};
		if (!base64 || !contentType) {
			return res.status(400).json({ error: 'base64 and contentType are required' });
		}
		try {
			const result = await uploadSupplyProductImage({
				base64,
				contentType,
				filename,
				productId: product_id || null,
			});
			return res.status(201).json({ data: result });
		} catch (err) {
			const message = err?.message || 'Upload failed';
			if (/bucket not found|Bucket not found/i.test(message)) {
				return res.status(500).json({
					error: 'Storage bucket missing. Run supabase/migrations/20260622_supply_images_storage.sql in Supabase.',
				});
			}
			return res.status(400).json({ error: message });
		}
	}, { adminOnly: true });
}
