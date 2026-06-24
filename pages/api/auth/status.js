import { getAuthConfigStatus } from '../../../lib/auth';

/** Public, non-secret auth config check (for deploy troubleshooting). */
export default function handler(req, res) {
	const status = getAuthConfigStatus();
	// Usernames aid targeted attacks in production; show them locally for login troubleshooting.
	if (process.env.NODE_ENV !== 'development') {
		delete status.dashboard_usernames;
	}
	res.json(status);
}
