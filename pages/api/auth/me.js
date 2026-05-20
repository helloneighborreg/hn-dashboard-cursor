import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session?.user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ user: session.user });
}
