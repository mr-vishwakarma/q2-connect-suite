import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { PortalRouteLoader } from "@/components/common/AppSplashScreen";

interface ProtectedAdminRouteProps {
  children: ReactNode;
}

export function ProtectedAdminRoute({ children }: ProtectedAdminRouteProps) {
  const { user, isAdmin, isSuperAdmin, loading } = useAuth();
  const navigate = useNavigate();

  const isUserSuperAdmin = isSuperAdmin || user?.role === 'super_admin' || Boolean(user?.isSuperAdmin);
  const isAllowedAdmin = isAdmin && !isUserSuperAdmin && user?.role !== 'student';

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate("/login?role=admin", { replace: true });
      } else if (!isAllowedAdmin) {
        navigate("/unauthorized", { replace: true });
      }
    }
  }, [user, isAllowedAdmin, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen w-full app-shell-bg flex items-center justify-center">
        <PortalRouteLoader />
      </div>
    );
  }

  if (!user || !isAllowedAdmin) return null;

  return <>{children}</>;
}
