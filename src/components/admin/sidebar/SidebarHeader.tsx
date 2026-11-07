import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SidebarHeaderProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onClose?: () => void;
}

export function SidebarHeader({
  isCollapsed = false,
  onToggleCollapse,
  onClose,
}: SidebarHeaderProps) {
  return (
    <div className="p-5 relative flex items-center justify-between border-b border-sidebar-border/50">
      <Link
        to="/admin/dashboard"
        onClick={onClose}
        className={cn("flex items-center gap-3 select-none", isCollapsed && "justify-center w-full")}
      >
        <img
          src="/hosteliq-logo.png"
          alt="Hosteliq Logo"
          width={40}
          height={40}
          decoding="async"
          className="h-10 w-auto max-w-[42px] object-contain shrink-0"
        />
        {!isCollapsed && (
          <div className="overflow-hidden whitespace-nowrap flex flex-col justify-center">
            <span className="text-foreground font-bold text-base block leading-tight tracking-tight">Hosteliq</span>
            <span className="text-[11px] text-muted-foreground font-medium mt-0.5">Admin Portal</span>
          </div>
        )}
      </Link>

      {/* Mobile close button */}
      {onClose && (
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Desktop collapse toggle button */}
      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className="absolute -right-3.5 top-6 bg-card border border-border rounded-full p-1 shadow-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors z-30"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
}
