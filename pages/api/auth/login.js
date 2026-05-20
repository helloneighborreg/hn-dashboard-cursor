import { getSession, verifyPassword } from '../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });

  const valid = await verifyPassword(password);
  if (!valid) return res.status(401).json({ error: 'Invalid password' });

  const session = await getSession(req, res);
  session.user = { role: 'admin', name: 'Admin' };
  await session.save();

  res.json({ ok: true });
}
