import { useAuth } from '@/hooks/useAuth';
import { ShieldCheck, Bell, Menu } from 'lucide-react';

export interface SuperAdminTopBarProps {
  title: string;
  onMenuToggle?: () => void;
}

export function SuperAdminTopBar({ title, onMenuToggle }: SuperAdminTopBarProps) {
  const { user } = useAuth();

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-lg text-foreground hover:bg-secondary transition-colors"
          aria-label="Toggle Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-foreground">{title}</h1>
          <p className="text-xs text-muted-foreground hidden sm:block">SaaS Governance & Platform Operations</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-xs font-semibold">
          <ShieldCheck className="w-4 h-4" />
          <span>Platform Root Admin</span>
        </div>

        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-foreground">{user?.name || 'Super Admin'}</p>
          <p className="text-xs text-muted-foreground">{user?.email || 'superadmin@q2connect.com'}</p>
        </div>
      </div>
    </header>
  );
}
