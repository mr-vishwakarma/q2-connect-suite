import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { PortalRouteLoader } from '@/components/common/AppSplashScreen';

export function ProtectedSuperAdminRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen w-full app-shell-bg flex items-center justify-center">
        <PortalRouteLoader />
      </div>
    );
  }

  // Check if authenticated user is Super Admin
  const isSuperAdmin = user?.isSuperAdmin || user?.role === 'super_admin' || user?.email === 'superadmin@q2connect.com';

  if (!user) {
    return <Navigate to="/login?role=super_admin" replace />;
  }

  if (!isSuperAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
