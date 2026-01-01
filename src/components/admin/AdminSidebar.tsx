import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
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
} from 'lucide-react';

const adminLinks = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/', icon: Home, label: 'Home' },
  { to: '/admin/register-student', icon: UserPlus, label: 'Register Student' },
  { to: '/admin/complaints', icon: MessageSquare, label: 'Complaints' },
  { to: '/admin/suggestions', icon: Lightbulb, label: 'Suggestions' },
  { to: '/admin/students', icon: Users, label: 'All Students' },
  { to: '/admin/admin-management', icon: Shield, label: 'Admin Management' },
];

export function AdminSidebar() {
  const location = useLocation();
  const { signOut, profile } = useAuth();

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
                <span>{link.label}</span>
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
