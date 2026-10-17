import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '@/types/api';
import { useAuth } from './AuthContext';

export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, loading, hasRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-slate-500">Yükleniyor…</div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !hasRole(...roles)) return <Navigate to="/" replace />;
  return <Outlet />;
}
