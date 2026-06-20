import { safeEqual } from './secureCompare';

/** Shared secret check for cron-triggered API routes. */
export function verifyCronSecret(req, res) {
	const secret = (process.env.CRON_SECRET || '').trim();
	if (!secret) {
		if (process.env.NODE_ENV === 'development') return true;
		res.status(503).json({ error: 'CRON_SECRET is not configured' });
		return false;
	}

	const auth = String(req.headers.authorization || '');
	const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
	const header = req.headers['x-cron-secret'] || bearer;
	if (!header || !safeEqual(header, secret)) {
		res.status(401).json({ error: 'Invalid cron secret' });
		return false;
	}
	return true;
}
