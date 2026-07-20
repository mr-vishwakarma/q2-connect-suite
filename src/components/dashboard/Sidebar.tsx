import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  UtensilsCrossed,
  MessageSquare,
  Lightbulb,
  LogOut,
  UserPlus,
  Users,
  CalendarCheck,
  ChefHat,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  isAdmin?: boolean;
  onNavigate?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ isAdmin = false, onNavigate, isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const location = useLocation();
  const { signOut, profile } = useAuth();

  const studentLinks = [
    { to: '/student/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/student/mess-off', icon: UtensilsCrossed, label: 'Leave Request' },
    { to: '/student/fees', icon: CalendarCheck, label: 'Fee History' },
    { to: '/student/complaints', icon: MessageSquare, label: 'Complaints' },
    { to: '/student/suggestions', icon: Lightbulb, label: 'Suggestions' },
  ];

  const adminLinks = [
    { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/register-student', icon: UserPlus, label: 'Register Student' },
    { to: '/admin/attendance', icon: CalendarCheck, label: 'Attendance' },
    { to: '/admin/mess-management', icon: ChefHat, label: 'Mess Management' },
    { to: '/admin/complaints', icon: MessageSquare, label: 'Complaints' },
    { to: '/admin/suggestions', icon: Lightbulb, label: 'Suggestions' },
    { to: '/admin/students', icon: Users, label: 'All Students' },
  ];

  const links = isAdmin ? adminLinks : studentLinks;

  const handleLinkClick = () => {
    onNavigate?.();
  };

  return (
    <aside className={cn("fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300", isCollapsed ? "w-20" : "w-64")}>
      {/* Logo */}
      <div className="p-6 relative">
        <Link to="/" className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-3")} onClick={handleLinkClick}>
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow shrink-0">
            <span className="text-primary-foreground font-bold text-lg">Q2</span>
          </div>
          {!isCollapsed && (
            <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} className="overflow-hidden whitespace-nowrap">
              <span className="text-sidebar-foreground font-semibold block">Q2 Management</span>
              <span className="text-xs text-muted-foreground">{isAdmin ? 'Admin Panel' : 'Student Panel'}</span>
            </motion.div>
          )}
        </Link>
        {onToggleCollapse && (
          <button 
            onClick={onToggleCollapse}
            className="absolute -right-3 top-8 bg-card border border-border rounded-full p-1 shadow-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {links.map((link) => {
          const isActive = location.pathname === link.to;
          return (
            <motion.div
              key={link.to}
              whileHover={{ x: 4 }}
              transition={{ duration: 0.2 }}
            >
              <Link
                to={link.to}
                onClick={handleLinkClick}
                className={cn(
                  'flex items-center px-4 py-3 rounded-xl transition-all duration-200 group relative',
                  isCollapsed ? 'justify-center' : 'gap-3',
                  isActive
                    ? 'bg-primary text-primary-foreground font-medium shadow-lg'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
                style={isActive ? { boxShadow: '0 0 20px hsl(0 100% 50% / 0.4)' } : {}}
              >
                <link.icon className="w-5 h-5 shrink-0" />
                {!isCollapsed && <span className="flex-1 whitespace-nowrap">{link.label}</span>}
                
                {/* Tooltip for collapsed state */}
                {isCollapsed && (
                  <div className="absolute left-full ml-4 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                    {link.label}
                  </div>
                )}
              </Link>
            </motion.div>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-sidebar-border">
        <div className={cn("flex items-center rounded-xl bg-sidebar-accent/30", isCollapsed ? "justify-center p-2" : "gap-3 px-4 py-3")}>
          <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-medium text-sm">
              {profile?.name?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0 overflow-hidden whitespace-nowrap">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {profile?.name || 'User'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {isAdmin ? 'Administrator' : 'Student'}
              </p>
            </div>
          )}
        </div>
        
        <button
          onClick={signOut}
          className={cn("flex items-center mt-2 w-full rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors group relative", isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3")}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!isCollapsed && <span>Logout</span>}
          {isCollapsed && (
            <div className="absolute left-full ml-4 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
              Logout
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
