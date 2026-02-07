import { Link, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useHostel } from '@/contexts/HostelContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { differenceInDays, parseISO } from 'date-fns';
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
  DollarSign,
  Building2,
  Bell,
  CalendarCheck,
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

export function AdminSidebar() {
  const location = useLocation();
  const { signOut, profile, user, isAdmin } = useAuth();
  const { selectedHostel } = useHostel();
  const [alertCount, setAlertCount] = useState(0);

  const fetchAlertCount = useCallback(async () => {
    try {
      const { data: students } = await supabase
        .from('students')
        .select('valid_date')
        .eq('hostel', selectedHostel);

      if (!students) {
        setAlertCount(0);
        return;
      }

      const today = new Date();
      let count = 0;

      students.forEach(student => {
        if (student.valid_date) {
          const validDate = parseISO(student.valid_date);
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

  useEffect(() => {
    if (!user || !isAdmin) return;

    const channel = supabase
      .channel(`students-alertcount-${selectedHostel}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'students',
          filter: `hostel=eq.${selectedHostel}`,
        },
        () => fetchAlertCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isAdmin, selectedHostel, fetchAlertCount]);

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-card border-r border-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <Link to="/admin/dashboard" className="flex items-center gap-3">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg"
            style={{ boxShadow: '0 0 20px hsl(217 91% 50% / 0.4)' }}
          >
            <span className="text-primary-foreground font-bold text-lg">Q2</span>
          </motion.div>
          <div>
            <span className="text-foreground font-bold block">Dashboard</span>
            <span className="text-xs text-muted-foreground">Admin Panel</span>
          </div>
        </Link>
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
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                  isActive
                    ? 'bg-primary text-primary-foreground font-medium shadow-lg'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
                style={isActive ? { boxShadow: '0 0 20px hsl(217 91% 50% / 0.4)' } : {}}
              >
                <link.icon className="w-5 h-5" />
                <span className="flex-1">{link.label}</span>
                {isAlertLink && alertCount > 0 && (
                  <span className="flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-bold rounded-full bg-destructive text-destructive-foreground">
                    {alertCount}
                  </span>
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
          style={{ boxShadow: '0 0 20px hsl(217 91% 50% / 0.4)' }}
        >
          <LogOut className="w-5 h-5" />
          <span>Log Out</span>
        </motion.button>
      </div>
    </aside>
  );
}
