import { useAuth } from '@/hooks/useAuth';
import { Bell, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface TopBarProps {
  title: string;
}

export function TopBar({ title }: TopBarProps) {
  const { profile, isAdmin } = useAuth();

  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="w-64 pl-9 bg-secondary border-border focus:border-primary"
          />
        </div>

        <button className="relative p-2 rounded-lg hover:bg-secondary transition-colors">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
        </button>

        <div className="flex items-center gap-3 pl-4 border-l border-border">
          <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center">
            <span className="text-primary-foreground font-medium text-sm">
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
