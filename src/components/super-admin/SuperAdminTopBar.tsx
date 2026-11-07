import { useAuth } from '@/hooks/useAuth';
import { Menu, User } from 'lucide-react';

export interface SuperAdminTopBarProps {
  title: string;
  onMenuToggle?: () => void;
  isMenuOpen?: boolean;
}

export function SuperAdminTopBar({ title, onMenuToggle, isMenuOpen = false }: SuperAdminTopBarProps) {
  const { user } = useAuth();

  const displayName = user?.name || 'Super Administrator';
  const displayEmail = user?.email || 'superadmin@hosteliq.in';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'SA';

  return (
    <header className="h-16 bg-card/95 backdrop-blur-md border-b border-border flex items-center justify-between px-3.5 sm:px-6 sticky top-0 z-20">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-lg text-foreground hover:bg-secondary transition-colors shrink-0"
          aria-label="Toggle Menu"
          aria-expanded={isMenuOpen}
          aria-controls="super-admin-sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-base sm:text-xl font-bold text-foreground truncate">{title}</h1>
          <p className="text-xs text-muted-foreground hidden sm:block truncate">SaaS Governance & Platform Operations</p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2.5 pl-2">
          <div className="text-right hidden sm:flex flex-col justify-center min-w-0">
            <p className="text-sm font-semibold text-foreground leading-snug tracking-tight truncate max-w-[200px] md:max-w-[280px]">
              {displayName}
            </p>
            <p className="text-xs text-muted-foreground font-normal leading-tight mt-0.5 truncate max-w-[200px] md:max-w-[280px]">
              {displayEmail}
            </p>
          </div>

          <div
            className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500/20 to-purple-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs shadow-sm shrink-0 select-none"
            title={`${displayName} (${displayEmail})`}
            aria-label={`Logged in as ${displayName}`}
          >
            {initials ? initials : <User className="w-4 h-4" />}
          </div>
        </div>
      </div>
    </header>
  );
}
