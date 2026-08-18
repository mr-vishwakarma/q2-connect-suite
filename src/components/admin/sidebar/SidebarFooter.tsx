import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

export interface SidebarFooterProps {
  isCollapsed?: boolean;
  onNavigate?: () => void;
}

export function SidebarFooter({ isCollapsed = false, onNavigate }: SidebarFooterProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    onNavigate?.();
    await signOut();
    navigate('/');
  };

  return (
    <div className="p-3 border-t border-sidebar-border/50">
      <button
        onClick={handleLogout}
        className={cn(
          "flex items-center w-full rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors group relative active:scale-95 select-none",
          isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3"
        )}
        aria-label="Logout"
      >
        <LogOut className="w-5 h-5 shrink-0" />
        {!isCollapsed && <span className="text-sm font-medium">Logout</span>}
        {isCollapsed && (
          <div className="absolute left-full ml-3 px-2.5 py-1 bg-popover text-popover-foreground text-xs rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity whitespace-nowrap z-50">
            Logout
          </div>
        )}
      </button>
    </div>
  );
}
