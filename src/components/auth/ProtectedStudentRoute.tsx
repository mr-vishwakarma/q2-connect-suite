import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { policyService } from "@/services/api/policy.service";
import { PortalRouteLoader } from "@/components/common/AppSplashScreen";

interface ProtectedStudentRouteProps {
  children: ReactNode;
}

export function ProtectedStudentRoute({ children }: ProtectedStudentRouteProps) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [checkingPolicies, setCheckingPolicies] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const verifyAccess = async () => {
      if (loading) return;

      if (!user) {
        navigate("/login?role=student", { replace: true });
        return;
      }

      if (user.role !== 'student') {
        navigate("/unauthorized", { replace: true });
        return;
      }

      // If user is already on the acceptance screen, do not loop
      if (location.pathname === '/student/accept-policies') {
        if (isMounted) setCheckingPolicies(false);
        return;
      }

      try {
        const res = await policyService.getStudentStatus();
        if (isMounted) {
          if (!res.allAccepted) {
            navigate("/student/accept-policies", { replace: true });
            return;
          }
          setCheckingPolicies(false);
        }
      } catch (err: unknown) {
        const apiErr = err as { response?: { data?: { code?: string } } };
        if (apiErr.response?.data?.code === 'POLICY_ACCEPTANCE_REQUIRED') {
          if (isMounted) {
            navigate("/student/accept-policies", { replace: true });
          }
          return;
        }
        if (isMounted) {
          setCheckingPolicies(false);
        }
      }
    };

    verifyAccess();

    return () => {
      isMounted = false;
    };
  }, [user, loading, navigate, location.pathname]);

  if (loading || (checkingPolicies && location.pathname !== '/student/accept-policies')) {
    return (
      <div className="min-h-screen w-full app-shell-bg flex items-center justify-center">
        <PortalRouteLoader />
      </div>
    );
  }

  if (!user || user.role !== 'student') return null;

  return <>{children}</>;
}
