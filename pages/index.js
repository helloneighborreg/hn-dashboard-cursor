import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Eye, EyeOff, Lock } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Invalid password'); return; }
      router.push('/dashboard');
    } catch {
      setError('Cannot reach the server. Run npm run dev in the project folder, then open http://localhost:3000');
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
          {/* Logo area */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-500 mb-4 shadow-lg">
              <span className="text-white text-2xl font-bold">HN</span>
            </div>
            <h1 className="text-white text-2xl font-bold">Hello Neighbor</h1>
            <p className="text-brand-300 text-sm mt-1">Real Estate Group · Operations</p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <h2 className="text-lg font-semibold text-dark mb-1">Welcome back</h2>
            <p className="text-muted text-sm mb-6">Sign in to access the dashboard</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pl-9 pr-10"
                    placeholder="Enter your password"
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

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !password}
                className="btn-primary w-full justify-center py-2.5"
              >
                {loading ? 'Signing in…' : 'Sign in'}
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
