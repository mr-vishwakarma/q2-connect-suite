import { cn } from '@/lib/utils';
import { SidebarHeader } from './sidebar/SidebarHeader';
import { SidebarNavigation } from './sidebar/SidebarNavigation';
import { SidebarFooter } from './sidebar/SidebarFooter';

export interface AdminSidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}

export function AdminSidebar({
  isCollapsed = false,
  onToggleCollapse,
  onNavigate,
}: AdminSidebarProps) {
  return (
    <aside
      id="admin-desktop-sidebar"
      className={cn(
        "h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 select-none",
        isCollapsed ? "w-20" : "w-64"
      )}
      aria-label="Admin Navigation"
    >
      <SidebarHeader isCollapsed={isCollapsed} onToggleCollapse={onToggleCollapse} onClose={onNavigate} />
      <SidebarNavigation isCollapsed={isCollapsed} onNavigate={onNavigate} />
      <SidebarFooter isCollapsed={isCollapsed} onNavigate={onNavigate} />
    </aside>
  );
}
