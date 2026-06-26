import { withAuth } from '../../../../../lib/auth';
import { isAdmin } from '../../../../../lib/roles';
import { uploadPropertyBackupImage } from '../../../../../lib/propertyDetailsStorage';
import { rejectHiddenProperty } from '../../../../../lib/hiddenProperties';

export const config = {
	api: {
		bodyParser: {
			sizeLimit: '8mb',
		},
	},
};

export default async function handler(req, res) {
	await withAuth(req, res, async (session) => {
		if (req.method !== 'POST') {
			res.status(405).end();
			return;
		}
		if (!isAdmin(session.user)) {
			return res.status(403).json({ error: 'Forbidden' });
		}
		const { id: propertyId } = req.query;
		const { base64, contentType, filename } = req.body || {};
		if (!propertyId) {
			return res.status(400).json({ error: 'Property id is required.' });
		}
		if (rejectHiddenProperty(propertyId, res)) return;
		if (!base64 || !contentType) {
			return res.status(400).json({ error: 'base64 and contentType are required' });
		}
		try {
			const result = await uploadPropertyBackupImage({
				base64,
				contentType,
				filename,
				propertyId,
			});
			return res.status(201).json({ data: result });
		} catch (err) {
			const message = err?.message || 'Upload failed';
			if (/bucket not found|Bucket not found/i.test(message)) {
				return res.status(500).json({
					error: 'Storage bucket missing. Run supabase/migrations/20260626_property_details.sql in Supabase.',
				});
			}
			return res.status(400).json({ error: message });
		}
	});
}
