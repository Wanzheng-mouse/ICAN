import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppStore } from '@/stores/useAppStore';

/** 无需登录即可访问的路由 */
const PUBLIC_PATHS = ['/login', '/forgot-password', '/help'];

interface RequireAuthProps {
  children: ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const user = useAppStore((s) => s.user);
  const location = useLocation();

  if (!user && !PUBLIC_PATHS.includes(location.pathname)) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (user && location.pathname === '/login') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
