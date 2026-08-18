import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedStudentRouteProps {
  children: ReactNode;
}

export function ProtectedStudentRoute({ children }: ProtectedStudentRouteProps) {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate("/login", { replace: true });
      } else if (isAdmin) {
        navigate("/admin/dashboard", { replace: true });
      }
    }
  }, [user, isAdmin, loading, navigate]);

  if (loading) return null;

  if (!user || isAdmin) return null;

  return <>{children}</>;
}
