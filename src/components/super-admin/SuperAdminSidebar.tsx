import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  GitFork,
  CreditCard,
  ToggleLeft,
  ShieldAlert,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const SUPER_ADMIN_NAV_LINKS = [
  { to: '/super-admin/dashboard', icon: LayoutDashboard, label: 'Control Center' },
  { to: '/super-admin/organizations', icon: Building2, label: 'Organizations' },
  { to: '/super-admin/hostels', icon: GitFork, label: 'Hostel Branches' },
  { to: '/super-admin/plans', icon: CreditCard, label: 'Subscription Plans' },
  { to: '/super-admin/features', icon: ToggleLeft, label: 'Feature Catalog' },
  { to: '/super-admin/audit-logs', icon: ShieldAlert, label: 'Audit Logs' },
];

export interface SuperAdminSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onClose?: () => void;
}

export function SuperAdminSidebar({
  isCollapsed,
  onToggleCollapse,
  onClose,
}: SuperAdminSidebarProps) {
  const location = useLocation();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    onClose?.();
    await signOut();
    navigate('/login');
  };

  return (
    <aside
      className={cn(
        'h-screen bg-card border-r border-border flex flex-col transition-all duration-300 select-none z-30',
        isCollapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="p-5 flex items-center justify-between border-b border-border/50 relative">
        <Link to="/super-admin/dashboard" onClick={onClose} className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg text-white font-black text-xl shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <span className="font-bold text-base text-foreground leading-tight block">Q2 Platform</span>
              <span className="text-xs text-amber-500 font-semibold uppercase tracking-wider">Super Admin</span>
            </div>
          )}
        </Link>

        {/* Collapse toggle */}
        <button
          onClick={onToggleCollapse}
          className="absolute -right-3.5 top-6 bg-card border border-border rounded-full p-1 shadow-md text-muted-foreground hover:text-foreground transition-colors hidden lg:flex"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto custom-scrollbar">
        {SUPER_ADMIN_NAV_LINKS.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.to;

          return (
            <Link
              key={link.to}
              to={link.to}
              onClick={onClose}
              className={cn(
                'flex items-center px-4 py-3 rounded-xl transition-all duration-200 relative group',
                isCollapsed ? 'justify-center' : 'gap-3',
                isActive
                  ? 'bg-amber-500/20 text-amber-400 font-semibold border border-amber-500/30 shadow-md'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!isCollapsed && <span className="text-sm">{link.label}</span>}
              {isCollapsed && (
                <div className="absolute left-full ml-3 px-2.5 py-1 bg-popover text-popover-foreground text-xs rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                  {link.label}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border/50">
        <button
          onClick={handleLogout}
          className={cn(
            'flex items-center w-full rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors p-3 active:scale-95',
            isCollapsed ? 'justify-center' : 'gap-3'
          )}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">Log out</span>}
        </button>
      </div>
    </aside>
  );
}
