import {
  LayoutDashboard,
  UserPlus,
  UserCheck,
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
  CreditCard,
} from 'lucide-react';
import type { PortalNavSection } from '@/components/layout/PortalShell';

export const ADMIN_NAV_LINKS = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/analytics', icon: BarChart, label: 'Analytics', featureKey: 'advanced_analytics' },
  { to: '/admin/register-student', icon: UserPlus, label: 'Register Student', featureKey: 'student_management' },
  { to: '/admin/students', icon: Users, label: 'All Students', featureKey: 'student_management' },
  { to: '/admin/fees', icon: DollarSign, label: 'Fee Management', featureKey: 'fee_management' },
  { to: '/admin/billing', icon: CreditCard, label: 'SaaS Billing' },
  { to: '/admin/rooms', icon: Building2, label: 'Room Management', featureKey: 'room_management' },
  { to: '/admin/attendance', icon: UserCheck, label: 'Attendance & Passes', featureKey: 'attendance' },
  { to: '/admin/expenses', icon: Receipt, label: 'Expense Tracker', featureKey: 'expense_management' },
  { to: '/admin/cashflow', icon: DollarSign, label: 'Cashflow & P&L', featureKey: 'expense_management' },
  { to: '/admin/leave-requests', icon: CalendarCheck, label: 'Leave Requests', featureKey: 'mess_management' },
  { to: '/admin/laundry', icon: Shirt, label: 'Laundry Management', featureKey: 'laundry' },
  { to: '/admin/complaints', icon: MessageSquare, label: 'Complaints', featureKey: 'complaints' },
  { to: '/admin/suggestions', icon: Lightbulb, label: 'Suggestions', featureKey: 'complaints' },
  { to: '/admin/notifications', icon: Bell, label: 'Notifications', featureKey: 'notifications' },
  { to: '/admin/alerts', icon: AlertTriangle, label: 'Alert', featureKey: 'fee_management' },
  { to: '/admin/admin-management', icon: Shield, label: 'Admin Management' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
] as const;

export const ADMIN_NAV_SECTIONS: PortalNavSection[] = [
  {
    title: 'Overview',
    links: [
      { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/admin/analytics', icon: BarChart, label: 'Analytics', featureKey: 'advanced_analytics' },
    ],
  },
  {
    title: 'Residents & Rooms',
    links: [
      { to: '/admin/students', icon: Users, label: 'All Students', featureKey: 'student_management' },
      { to: '/admin/register-student', icon: UserPlus, label: 'Register Student', featureKey: 'student_management' },
      { to: '/admin/rooms', icon: Building2, label: 'Room Management', featureKey: 'room_management' },
      { to: '/admin/attendance', icon: UserCheck, label: 'Attendance & Passes', featureKey: 'attendance' },
    ],
  },
  {
    title: 'Finance & Billing',
    links: [
      { to: '/admin/fees', icon: DollarSign, label: 'Fee Management', featureKey: 'fee_management' },
      { to: '/admin/expenses', icon: Receipt, label: 'Expense Tracker', featureKey: 'expense_management' },
      { to: '/admin/cashflow', icon: DollarSign, label: 'Cashflow & P&L', featureKey: 'expense_management' },
      { to: '/admin/billing', icon: CreditCard, label: 'SaaS Billing' },
    ],
  },
  {
    title: 'Operations',
    links: [
      { to: '/admin/leave-requests', icon: CalendarCheck, label: 'Leave Requests', featureKey: 'mess_management' },
      { to: '/admin/laundry', icon: Shirt, label: 'Laundry', featureKey: 'laundry' },
      { to: '/admin/complaints', icon: MessageSquare, label: 'Complaints', featureKey: 'complaints' },
      { to: '/admin/suggestions', icon: Lightbulb, label: 'Suggestions', featureKey: 'complaints' },
      { to: '/admin/alerts', icon: AlertTriangle, label: 'Alerts', featureKey: 'fee_management' },
      { to: '/admin/notifications', icon: Bell, label: 'Notifications', featureKey: 'notifications' },
    ],
  },
  {
    title: 'Account',
    links: [
      { to: '/admin/admin-management', icon: Shield, label: 'Admin Team' },
      { to: '/admin/settings', icon: Settings, label: 'Settings' },
    ],
  },
];
