import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req, res);
  session.destroy();
  res.json({ ok: true });
}
