import {
	adminTestCheckoutRecord,
	isAdminTestCheckoutCode,
	publicCheckoutPayload,
} from '../../../lib/guestCheckout';
import { confirmGuestCheckout } from '../../../lib/guestCheckoutDb';
import { notifyGuestCheckoutConfirmed } from '../../../lib/guestCheckoutNotify';

export default async function handler(req, res) {
	if (req.method !== 'POST') return res.status(405).end();

	try {
		const { code, enjoyed_stay, rating, feedback } = req.body || {};

		if (isAdminTestCheckoutCode(code)) {
			return res.json({
				data: publicCheckoutPayload(adminTestCheckoutRecord({ confirmed: true })),
			});
		}

		const checkout = await confirmGuestCheckout(code, { enjoyed_stay, rating, feedback });

		try {
			await notifyGuestCheckoutConfirmed(checkout);
		} catch (err) {
			console.error('Guest checkout cleaner notify failed:', err.message);
		}

		return res.json({ data: publicCheckoutPayload(checkout) });
	} catch (err) {
		if (err.status === 409) {
			return res.status(409).json({
				error: err.message,
				data: publicCheckoutPayload(err.checkout),
			});
		}
		if (err.status) {
			return res.status(err.status).json({ error: err.message });
		}
		console.error('Guest checkout confirm failed:', err.message);
		const message = /permission denied|does not exist|PGRST205/i.test(err.message || '')
			? 'Checkout is temporarily unavailable. Please try again in a moment or contact your host.'
			: (err.message || 'Confirmation failed');
		return res.status(500).json({ error: message });
	}
}
