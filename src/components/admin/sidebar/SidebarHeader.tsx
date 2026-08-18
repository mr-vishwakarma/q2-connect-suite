import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
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
        <motion.div
          whileHover={{ rotate: 180 }}
          transition={{ duration: 0.3 }}
          className="w-10 h-10 flex items-center justify-center shrink-0 overflow-hidden"
        >
          <img src="/q2-logo.png" alt="Q2 Logo" className="w-full h-full object-contain" />
        </motion.div>
        {!isCollapsed && (
          <div className="overflow-hidden whitespace-nowrap">
            <span className="text-foreground font-bold text-base block leading-tight">Dashboard</span>
            <span className="text-xs text-muted-foreground">Admin Panel</span>
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
