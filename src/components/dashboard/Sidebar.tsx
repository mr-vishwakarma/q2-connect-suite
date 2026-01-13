import { Link, useLocation } from 'react-router-dom';
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
} from 'lucide-react';

interface SidebarProps {
  isAdmin?: boolean;
}

export function Sidebar({ isAdmin = false }: SidebarProps) {
  const location = useLocation();
  const { signOut, profile } = useAuth();

  const studentLinks = [
    { to: '/student/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/student/mess-off', icon: UtensilsCrossed, label: 'Mess Off' },
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

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="p-6">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
            <span className="text-primary-foreground font-bold text-lg">Q2</span>
          </div>
          <div>
            <span className="text-sidebar-foreground font-semibold block">Q2 Management</span>
            <span className="text-xs text-muted-foreground">{isAdmin ? 'Admin Panel' : 'Student Panel'}</span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1">
        {links.map((link) => {
          const isActive = location.pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-primary font-medium'
                  : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <link.icon className="w-5 h-5" />
              <span>{link.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-sidebar-accent/30">
          <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center">
            <span className="text-primary-foreground font-medium text-sm">
              {profile?.name?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {profile?.name || 'User'}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {isAdmin ? 'Administrator' : 'Student'}
            </p>
          </div>
        </div>
        
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-4 py-3 mt-2 w-full rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
