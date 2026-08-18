import { LucideIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface SidebarNavItemProps {
  to: string;
  icon: LucideIcon;
  label: string;
  isCollapsed?: boolean;
  badgeCount?: number;
  onNavigate?: () => void;
}

export function SidebarNavItem({
  to,
  icon: Icon,
  label,
  isCollapsed = false,
  badgeCount,
  onNavigate,
}: SidebarNavItemProps) {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== '/admin/dashboard' && location.pathname.startsWith(to));

  return (
    <div className="relative group">
      <Link
        to={to}
        onClick={() => {
          onNavigate?.();
        }}
        className={cn(
          'flex items-center px-4 py-3 rounded-xl transition-all duration-200 relative select-none',
          isCollapsed ? 'justify-center' : 'gap-3',
          isActive
            ? 'bg-primary text-primary-foreground font-medium shadow-md'
            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
        )}
        style={isActive ? { boxShadow: '0 0 20px hsl(var(--primary) / 0.35)' } : {}}
      >
        <Icon className="w-5 h-5 shrink-0" />
        {!isCollapsed && <span className="flex-1 whitespace-nowrap text-sm">{label}</span>}

        {/* Tooltip for collapsed desktop state */}
        {isCollapsed && (
          <div className="absolute left-full ml-3 px-2.5 py-1 bg-popover text-popover-foreground text-xs rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity whitespace-nowrap z-50">
            {label}
          </div>
        )}

        {/* Badge count indicator */}
        {badgeCount !== undefined && badgeCount > 0 && !isCollapsed && (
          <span className="flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-bold rounded-full bg-destructive text-destructive-foreground shrink-0">
            {badgeCount}
          </span>
        )}

        {/* Dot indicator when collapsed */}
        {badgeCount !== undefined && badgeCount > 0 && isCollapsed && (
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-destructive" />
        )}
      </Link>
    </div>
  );
}
