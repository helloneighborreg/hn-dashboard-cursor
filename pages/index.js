import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { BrandLogo } from '../components/Logo';

export default function LoginPage({ loginError: initialLoginError = '' }) {
  const [rememberMe, setRememberMe] = useState(true);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState(initialLoginError);
  const [devUsernames, setDevUsernames] = useState(null);
  const usernameRef = useRef(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('hn_remembered_username');
      if (saved && usernameRef.current) usernameRef.current.value = saved;
    } catch {
      // ignore
    }

    const params = new URLSearchParams(window.location.search);
    const loginError = params.get('login_error');
    if (loginError && loginError !== initialLoginError) {
      setError(loginError);
    }
    if (loginError) {
      window.history.replaceState({}, '', '/');
    } else if (params.has('password')) {
      const savedUser = params.get('username')?.trim();
      if (savedUser && usernameRef.current) usernameRef.current.value = savedUser;
      setError('Sign-in was interrupted. Enter your password and try again.');
      window.history.replaceState({}, '', '/');
    }
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    fetch('/api/auth/status')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.dashboard_usernames) && data.dashboard_usernames.length) {
          setDevUsernames(data.dashboard_usernames);
        }
      })
      .catch(() => {});
  }, []);

  function rememberUsername() {
    try {
      const value = usernameRef.current?.value?.trim();
      if (rememberMe && value) window.localStorage.setItem('hn_remembered_username', value);
      else window.localStorage.removeItem('hn_remembered_username');
    } catch {
      // ignore
    }
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

          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <form
              method="post"
              action="/api/auth/login"
              className="space-y-4"
              autoComplete="on"
              onSubmit={rememberUsername}
            >
              <div>
                <label className="label" htmlFor="login-username">Username</label>
                <input
                  ref={usernameRef}
                  id="login-username"
                  name="username"
                  type="text"
                  className="input"
                  placeholder="Username"
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="login-password">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    id="login-password"
                    name="password"
                    type={showPass ? 'text' : 'password'}
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
                  name="rememberMe"
                  value="1"
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

              {devUsernames && (
                <p className="text-xs text-muted">
                  Local dev accounts: {devUsernames.join(', ')}. Passwords are in{' '}
                  <code className="text-[11px]">env.local</code> (not production).
                </p>
              )}

              <button
                type="submit"
                className="btn-primary w-full justify-center py-2.5"
              >
                Sign in
              </button>
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

export async function getServerSideProps({ query }) {
  const loginError = typeof query.login_error === 'string' ? query.login_error : '';
  return { props: { loginError } };
}
