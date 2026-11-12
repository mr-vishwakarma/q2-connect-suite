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
    <div className="bg-gradient-to-r from-[#2D1F4B]/95 via-[#1C1A36]/95 to-[#2B1B3B]/95 backdrop-blur-md border-b border-primary/30 text-[#F0EFF8] px-4 py-2 text-xs font-semibold flex items-center justify-between gap-3 shadow-lg sticky top-0 z-50">
      <div className="flex items-center gap-2 min-w-0">
        <ShieldAlert className="w-4 h-4 text-[#ED91C1] animate-pulse shrink-0" />
        <span className="truncate">Super Admin Impersonation Session active for <strong className="text-primary">{orgName}</strong></span>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleExit}
        className="h-7 px-3 bg-white/[0.06] hover:bg-white/[0.12] text-[#F0EFF8] border-white/15 font-semibold text-xs shrink-0"
      >
        <LogOut className="w-3.5 h-3.5 mr-1" />
        Exit Impersonation
      </Button>
    </div>
  );
}
