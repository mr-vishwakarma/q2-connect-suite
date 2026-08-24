import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ImpersonationBanner() {
  const navigate = useNavigate();
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [orgName, setOrgName] = useState('');

  useEffect(() => {
    const checkImpersonation = () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.isImpersonating) {
            setIsImpersonating(true);
            setOrgName(payload.organizationName || 'Tenant Organization');
          } else {
            setIsImpersonating(false);
          }
        }
      } catch (e) {
        setIsImpersonating(false);
      }
    };
    checkImpersonation();
  }, []);

  const handleExit = () => {
    // Return to super admin session if preserved
    const superToken = localStorage.getItem('superAdminToken');
    if (superToken) {
      localStorage.setItem('token', superToken);
      localStorage.removeItem('superAdminToken');
    }
    navigate('/super-admin/dashboard');
    window.location.reload();
  };

  if (!isImpersonating) return null;

  return (
    <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 text-black px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-md sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-black animate-pulse" />
        <span>Super Admin Impersonation Session active for <strong>{orgName}</strong></span>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleExit}
        className="h-7 px-3 bg-black/20 hover:bg-black/40 text-black border-black/30 font-bold text-xs"
      >
        <LogOut className="w-3.5 h-3.5 mr-1" />
        Exit Impersonation
      </Button>
    </div>
  );
}
