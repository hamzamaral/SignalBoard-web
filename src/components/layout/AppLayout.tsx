import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-2.5 py-1.5 text-sm ${
    isActive
      ? 'border-b-2 border-accent font-medium text-ink'
      : 'text-slate-600 hover:text-ink'
  }`;

export function AppLayout() {
  const { user, logout, hasRole } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="font-display text-xl font-bold tracking-tight text-ink">SignalBoard</p>
            <p className="text-xs text-slate-500">Kamu · Özel · Takvim</p>
          </div>
          <nav className="flex flex-wrap items-center gap-1">
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
              Takvim
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
              className="rounded border border-slate-300 px-2.5 py-1 text-sm hover:bg-slate-50"
            >
              Çıkış
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
