import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { BrandLogo } from '../components/Logo';
import PwaInstallButton from '../components/PwaInstallButton';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Prefill username for convenience (never store password).
  // Uses localStorage since this is explicitly opt-in via "Remember me".
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('hn_remembered_username');
      if (saved) setUsername(saved);
    } catch {
      // ignore
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const trimmedUsername = username.trim();
      if (!trimmedUsername) {
        setError('Username is required.');
        return;
      }
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUsername, password, rememberMe }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Invalid username or password'); return; }
      if (typeof window !== 'undefined') {
        try {
          if (rememberMe) window.localStorage.setItem('hn_remembered_username', trimmedUsername);
          else window.localStorage.removeItem('hn_remembered_username');
        } catch {
          // ignore
        }
      }
      router.push(data.redirect || '/dashboard');
    } catch {
      setError('Cannot reach the server. Run npm run dev and open the URL shown in the terminal (e.g. http://localhost:3000).');
    } finally {
      setLoading(false);
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

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Username</label>
                <input
                  type="text"
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
