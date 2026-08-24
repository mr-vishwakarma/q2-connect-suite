import { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  UserPlus,
  MessageSquare,
  Lightbulb,
  Users,
  Shield,
  AlertTriangle,
  Building2,
  Bell,
  CalendarCheck,
  DollarSign,
  BarChart,
  Shirt,
  Settings,
  Receipt,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useHostel } from '@/contexts/HostelContext';
import { studentService } from '@/services/api';
import { SidebarNavItem } from './SidebarNavItem';

export const ADMIN_NAV_LINKS = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/analytics', icon: BarChart, label: 'Analytics', featureKey: 'advanced_analytics' },
  { to: '/admin/register-student', icon: UserPlus, label: 'Register Student', featureKey: 'student_management' },
  { to: '/admin/students', icon: Users, label: 'All Students', featureKey: 'student_management' },
  { to: '/admin/fees', icon: DollarSign, label: 'Fee Management', featureKey: 'fee_management' },
  { to: '/admin/rooms', icon: Building2, label: 'Room Management', featureKey: 'room_management' },
  { to: '/admin/expenses', icon: Receipt, label: 'Expense Tracker', featureKey: 'expense_management' },
  { to: '/admin/leave-requests', icon: CalendarCheck, label: 'Leave Requests', featureKey: 'mess_management' },
  { to: '/admin/laundry', icon: Shirt, label: 'Laundry Management', featureKey: 'laundry' },
  { to: '/admin/complaints', icon: MessageSquare, label: 'Complaints', featureKey: 'complaints' },
  { to: '/admin/suggestions', icon: Lightbulb, label: 'Suggestions', featureKey: 'complaints' },
  { to: '/admin/notifications', icon: Bell, label: 'Notifications', featureKey: 'notifications' },
  { to: '/admin/alerts', icon: AlertTriangle, label: 'Alert', featureKey: 'fee_management' },
  { to: '/admin/admin-management', icon: Shield, label: 'Admin Management' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
] as const;

export interface SidebarNavigationProps {
  isCollapsed?: boolean;
  onNavigate?: () => void;
}

export function SidebarNavigation({ isCollapsed = false, onNavigate }: SidebarNavigationProps) {
  const { user, isAdmin } = useAuth();
  const { selectedHostel } = useHostel();
  const [alertCount, setAlertCount] = useState(0);

  const fetchAlertCount = useCallback(async () => {
    try {
      const response = await studentService.getAlertsCount({ hostel: selectedHostel });
      if (response.success && response.data) {
        setAlertCount(response.data.count || 0);
      }
    } catch (error) {
      console.error('Error fetching alert count in sidebar:', error);
    }
  }, [selectedHostel]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchAlertCount();
    }
  }, [user, isAdmin, selectedHostel, fetchAlertCount]);

  return (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
      {ADMIN_NAV_LINKS.map((link) => {
        const isAlertLink = link.to === '/admin/alerts';
        return (
          <SidebarNavItem
            key={link.to}
            to={link.to}
            icon={link.icon}
            label={link.label}
            isCollapsed={isCollapsed}
            badgeCount={isAlertLink ? alertCount : undefined}
            onNavigate={onNavigate}
          />
        );
      })}
    </nav>
  );
}
