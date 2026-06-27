import { useEffect, useState } from 'react';
import Head from 'next/head';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { BrandLogo } from '../components/Logo';
import PwaInstallButton from '../components/PwaInstallButton';
import { getRememberedUsername } from '../lib/auth';

export default function LoginPage({ rememberedUsername, loginError }) {
  const [username, setUsername] = useState(rememberedUsername || '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(loginError || '');

  // Prefer server-set cookie; fall back to legacy localStorage for existing devices.
  useEffect(() => {
    if (rememberedUsername) {
      setUsername(rememberedUsername);
      return;
    }
    try {
      const saved = window.localStorage.getItem('hn_remembered_username');
      if (saved) setUsername(saved);
    } catch {
      // ignore
    }
  }, [rememberedUsername]);

  useEffect(() => {
    if (loginError) setError(loginError);
  }, [loginError]);

  function handleSubmit() {
    setError('');
    setLoading(true);
  }

  return (
    <>
      <Head>
        <title>Sign In — Hello Neighbor Dashboard</title>
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-brand-900 via-brand-800 to-dark flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <BrandLogo variant="login" />
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            {/* Native form POST keeps session cookies reliable on mobile Safari / iOS PWA. */}
            <form
              method="POST"
              action="/api/auth/login"
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <input type="hidden" name="rememberMe" value={rememberMe ? '1' : '0'} />
              <div>
                <label className="label">Username</label>
                <input
                  type="text"
                  name="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input"
                  placeholder="Username"
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pl-9 pr-10"
                    placeholder="Password"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-dark"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-muted select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                Remember me on this device
              </label>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !password || !username.trim()}
                className="btn-primary w-full justify-center py-2.5"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>

              <PwaInstallButton className="mt-1" />
            </form>
          </div>

          <p className="text-center text-brand-400 text-xs mt-6">
            Hello Neighbor Real Estate Group · Des Moines, IA
          </p>
        </div>
      </div>
    </>
  );
}

export async function getServerSideProps({ req, query }) {
  const rememberedUsername = getRememberedUsername(req);
  const loginError = typeof query.login_error === 'string' ? query.login_error : '';

  return {
    props: {
      rememberedUsername,
      loginError,
    },
  };
}
