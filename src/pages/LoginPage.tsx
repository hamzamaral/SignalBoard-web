import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { getErrorMessage } from '@/lib/api';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('admin@signalboard.local');
  const [password, setPassword] = useState('Admin123!');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      const from = (location.state as { from?: { pathname?: string } })?.from?.pathname ?? '/';
      navigate(from, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/90 p-8 shadow-sm"
      >
        <h1 className="font-display text-3xl font-bold text-ink">SignalBoard</h1>
        <p className="mt-2 text-sm text-slate-500">
          Çok kaynaklı ilan toplama ve son tarih takibi
        </p>
        <label className="mt-6 block text-sm">
          E-posta
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="mt-4 block text-sm">
          Şifre
          <input
            type="password"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-lg bg-accent px-4 py-2.5 font-medium text-white hover:bg-accentDark disabled:opacity-60"
        >
          {busy ? 'Giriş…' : 'Giriş yap'}
        </button>
        <p className="mt-4 text-xs text-slate-400">
          Demo: admin@signalboard.local / Admin123!
        </p>
      </form>
    </div>
  );
}
