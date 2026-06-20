import { getAuthConfigStatus } from '../../../lib/auth';

/** Public, non-secret auth config check (for deploy troubleshooting). */
export default function handler(req, res) {
	// Omit usernames from the public payload — exposing them aids targeted credential attacks.
	const status = getAuthConfigStatus();
	delete status.dashboard_usernames;
	res.json(status);
}
