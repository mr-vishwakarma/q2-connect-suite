import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedAdminRouteProps {
  children: ReactNode;
}

export function ProtectedAdminRoute({ children }: ProtectedAdminRouteProps) {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate("/admin-login", { replace: true });
      } else if (!isAdmin) {
        navigate("/unauthorized", { replace: true });
      }
    }
  }, [user, isAdmin, loading, navigate]);

  if (user && isAdmin) return <>{children}</>;

  if (loading) return null;

  if (!user || !isAdmin) return null;

  return <>{children}</>;
}
