import { getAuthConfigStatus } from '../../../lib/auth';

/** Public, non-secret auth config check (for deploy troubleshooting). */
export default function handler(req, res) {
	res.json(getAuthConfigStatus());
}
