import { useAuth } from '@/hooks/useAuth';
import { Search, Menu } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { ThemeToggle } from '@/components/ThemeToggle';

interface TopBarProps {
  title: string;
  onMenuToggle?: () => void;
  showMenu?: boolean;
}

export function TopBar({ title, onMenuToggle, showMenu }: TopBarProps) {
  const { profile, isAdmin } = useAuth();

  return (
    <header className="h-14 sm:h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-3 sm:px-6 sticky top-0 z-30">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        {showMenu && (
          <button
            onClick={onMenuToggle}
            className="p-2 rounded-lg text-foreground hover:bg-secondary transition-colors shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-base sm:text-xl font-semibold text-foreground truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="w-64 pl-9 bg-secondary border-border focus:border-primary"
          />
        </div>

        <ThemeToggle />
        <NotificationBell />

        <div className="flex items-center gap-3 pl-2 sm:pl-4 border-l border-border">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full gradient-primary flex items-center justify-center">
            <span className="text-primary-foreground font-medium text-xs sm:text-sm">
              {profile?.name?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-foreground">{profile?.name || 'User'}</p>
            <p className="text-xs text-muted-foreground">{isAdmin ? 'Admin' : 'Student'}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
