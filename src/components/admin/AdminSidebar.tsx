import { Link, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { parseISO, differenceInDays } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useHostel } from '@/contexts/HostelContext';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  UserPlus,
  MessageSquare,
  Lightbulb,
  Users,
  LogOut,
  Home,
  Shield,
  AlertTriangle,
  Building2,
  Bell,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  DollarSign,
} from 'lucide-react';

const adminLinks = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/', icon: Home, label: 'Home' },
  { to: '/admin/register-student', icon: UserPlus, label: 'Register Student' },
  { to: '/admin/students', icon: Users, label: 'All Students' },
  { to: '/admin/fees', icon: DollarSign, label: 'Fee Management' },
  { to: '/admin/rooms', icon: Building2, label: 'Room Management' },
  { to: '/admin/leave-requests', icon: CalendarCheck, label: 'Leave Requests' },
  { to: '/admin/complaints', icon: MessageSquare, label: 'Complaints' },
  { to: '/admin/suggestions', icon: Lightbulb, label: 'Suggestions' },
  { to: '/admin/notifications', icon: Bell, label: 'Notifications' },
  { to: '/admin/alerts', icon: AlertTriangle, label: 'Alert' },
  { to: '/admin/admin-management', icon: Shield, label: 'Admin Management' },
];

interface AdminSidebarProps {
  onNavigate?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function AdminSidebar({ onNavigate, isCollapsed = false, onToggleCollapse }: AdminSidebarProps) {
  const location = useLocation();
  const { signOut, profile, user, isAdmin } = useAuth();
  const { selectedHostel } = useHostel();
  const [alertCount, setAlertCount] = useState(0);

  const fetchAlertCount = useCallback(async () => {
    try {
      const response = await api.get('/students', {
        params: { hostel: selectedHostel }
      });
      const students = response.data?.data;

      if (!students) {
        setAlertCount(0);
        return;
      }

      const today = new Date();
      let count = 0;

      students.forEach((student: any) => {
        if (student.validDate) {
          const validDate = parseISO(student.validDate);
          const daysLeft = differenceInDays(validDate, today);
          if (daysLeft <= 5) {
            count++;
          }
        }
      });

      setAlertCount(count);
    } catch (error) {
      console.error('Error fetching alert count:', error);
    }
  }, [selectedHostel]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchAlertCount();
    }
  }, [user, isAdmin, selectedHostel, fetchAlertCount]);

  const handleLinkClick = () => {
    onNavigate?.();
  };

  return (
    <aside className={cn("fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300", isCollapsed ? "w-20" : "w-64")}>
      {/* Logo */}
      <div className="p-6 relative">
        <Link to="/admin/dashboard" className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-3")} onClick={handleLinkClick}>
          <motion.div
            whileHover={{ rotate: 180 }}
            transition={{ duration: 0.3 }}
            className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow shrink-0"
          >
            <span className="text-primary-foreground font-bold text-lg">Q2</span>
          </motion.div>
          {!isCollapsed && (
            <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} className="overflow-hidden whitespace-nowrap">
              <span className="text-foreground font-bold block">Dashboard</span>
              <span className="text-xs text-muted-foreground">Admin Panel</span>
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
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {adminLinks.map((link) => {
          const isActive = location.pathname === link.to;
          const isAlertLink = link.to === '/admin/alerts';
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
                
                {isAlertLink && alertCount > 0 && !isCollapsed && (
                  <span className="flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-bold rounded-full bg-destructive text-destructive-foreground shrink-0">
                    {alertCount}
                  </span>
                )}
                
                {/* Red dot indicator when collapsed */}
                {isAlertLink && alertCount > 0 && isCollapsed && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-destructive" />
                )}
              </Link>
            </motion.div>
          );
        })}
      </nav>

      {/* Logout Button */}
      <div className="p-4 border-t border-border">
        <motion.button
          onClick={signOut}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl bg-primary text-primary-foreground font-medium transition-colors shadow-lg hover:bg-primary/90"
          style={{ boxShadow: '0 0 20px hsl(0 100% 50% / 0.4)' }}
        >
          <LogOut className="w-5 h-5" />
          <span>Log Out</span>
        </motion.button>
      </div>
    </aside>
  );
}
