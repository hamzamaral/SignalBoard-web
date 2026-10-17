import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm ${isActive ? 'bg-accent text-white' : 'text-slate-700 hover:bg-white/70'}`;

export function AppLayout() {
  const { user, logout, hasRole } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200/80 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="font-display text-2xl font-bold tracking-tight text-ink">SignalBoard</p>
            <p className="text-xs text-slate-500">Listing aggregator & deadline workflow</p>
          </div>
          <nav className="flex flex-wrap gap-1">
            <NavLink to="/" end className={linkClass}>
              Özet
            </NavLink>
            <NavLink to="/listings" className={linkClass}>
              Kamu
            </NavLink>
            <NavLink to="/private" className={linkClass}>
              Özel
            </NavLink>
            <NavLink to="/pipeline" className={linkClass}>
              Başvurularım
            </NavLink>
            <NavLink to="/profile" className={linkClass}>
              Profil
            </NavLink>
            <NavLink to="/reminders" className={linkClass}>
              Hatırlatıcı
            </NavLink>
            {hasRole('ADMIN') && (
              <NavLink to="/admin" className={linkClass}>
                Admin
              </NavLink>
            )}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-600">{user?.fullName}</span>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-white"
            >
              Çıkış
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
