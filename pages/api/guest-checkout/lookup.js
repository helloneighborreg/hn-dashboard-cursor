import {
	adminTestCheckoutRecord,
	isAdminTestCheckoutCode,
	normalizeCheckoutCode,
	publicCheckoutPayload,
} from '../../../lib/guestCheckout';
import { getGuestCheckoutByCode } from '../../../lib/guestCheckoutDb';
import { getPropertyPrimaryImageUrl } from '../../../lib/hospitable';
import { isHiddenPropertyId } from '../../../lib/hiddenProperties';

export default async function handler(req, res) {
	if (req.method !== 'POST') return res.status(405).end();

	try {
		const code = normalizeCheckoutCode(req.body?.code);
		if (!code) {
			return res.status(400).json({ error: 'Enter a valid checkout code (3 digits + 3 letters, e.g. 123ABC).' });
		}

		if (isAdminTestCheckoutCode(code)) {
			return res.json({ data: publicCheckoutPayload(adminTestCheckoutRecord()) });
		}

		const checkout = await getGuestCheckoutByCode(code);
		if (!checkout || isHiddenPropertyId(checkout.property_id)) {
			return res.status(404).json({
				error: 'That checkout code was not found. Please check the code in your instructions and try again.',
			});
		}

		const property_image_url = checkout.property_id
			? await getPropertyPrimaryImageUrl(checkout.property_id)
			: null;

		return res.json({ data: publicCheckoutPayload(checkout, { property_image_url }) });
	} catch (err) {
		console.error('Guest checkout lookup failed:', err.message);
		const message = /permission denied|does not exist|PGRST205/i.test(err.message || '')
			? 'Checkout is temporarily unavailable. Please try again in a moment or contact your host.'
			: (err.message || 'Lookup failed');
		return res.status(500).json({ error: message });
	}
}
