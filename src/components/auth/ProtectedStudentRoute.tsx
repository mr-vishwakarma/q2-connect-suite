import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedStudentRouteProps {
  children: ReactNode;
}

export function ProtectedStudentRoute({ children }: ProtectedStudentRouteProps) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate("/login?role=student", { replace: true });
      } else if (user.role !== 'student') {
        // STRICT: Super Admin and Admin are denied direct URL access to student portal
        navigate("/unauthorized", { replace: true });
      }
    }
  }, [user, loading, navigate]);

  if (loading) return null;

  if (!user || user.role !== 'student') return null;

  return <>{children}</>;
}
