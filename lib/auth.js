import { getIronSession } from 'iron-session';
import bcrypt from 'bcryptjs';

export const sessionOptions = {
  password: process.env.SESSION_SECRET || 'fallback-secret-change-me-in-env-32-chars!',
  cookieName: 'hn_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

export async function getSession(req, res) {
  return getIronSession(req, res, sessionOptions);
}

export async function verifyPassword(password) {
  const stored = process.env.DASHBOARD_PASSWORD;
  if (!stored) return false;
  // Support both plaintext (dev) and bcrypt hash (production)
  if (stored.startsWith('$2')) {
    return bcrypt.compare(password, stored);
  }
  return password === stored;
}

export async function withAuth(req, res, handler) {
  const session = await getSession(req, res);
  if (!session?.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  return handler(session);
}

export function requireAuth(gssp) {
  return async (context) => {
    const { req, res } = context;
    const session = await getSession(req, res);
    if (!session?.user) {
      return {
        redirect: { destination: '/', permanent: false },
      };
    }
    return gssp(context, session);
  };
}
