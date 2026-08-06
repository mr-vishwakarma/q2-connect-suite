import { ReactNode, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedAdminRouteProps {
  children: ReactNode;
}

export function ProtectedAdminRoute({ children }: ProtectedAdminRouteProps) {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate("/admin-login", { replace: true });
      } else if (!isAdmin) {
        navigate("/unauthorized", { replace: true });
      }
    }
  }, [user, isAdmin, loading, navigate]);

  // Trap browser Back button to prevent navigating out of admin panel while logged in
  useEffect(() => {
    if (!loading && user && isAdmin) {
      // Push state to history so back button stays within protected admin area
      window.history.pushState(null, "", window.location.href);

      const handlePopState = () => {
        window.history.pushState(null, "", window.location.href);
      };

      window.addEventListener("popstate", handlePopState);
      return () => {
        window.removeEventListener("popstate", handlePopState);
      };
    }
  }, [user, isAdmin, loading, location.pathname]);

  if (loading) return null;

  if (!user || !isAdmin) return null;

  return <>{children}</>;
}
