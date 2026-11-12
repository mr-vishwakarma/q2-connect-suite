import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Building2,
  CreditCard,
  FileDown,
  GitFork,
  LayoutDashboard,
  Lock,
  Settings,
  ShieldAlert,
  Ticket,
  ToggleLeft,
  UserCheck,
  Users,
} from 'lucide-react';
import { useSidebarDrawer } from '@/hooks/useSidebarDrawer';
import { useAuth } from '@/hooks/useAuth';
import { PortalNavSection, PortalShell } from '@/components/layout/PortalShell';

const SUPER_ADMIN_NAV_SECTIONS: PortalNavSection[] = [
  {
    title: 'Overview',
    links: [
      { to: '/super-admin/dashboard', icon: LayoutDashboard, label: 'Control Center' },
      { to: '/super-admin/analytics', icon: BarChart3, label: 'Platform Analytics' },
    ],
  },
  {
    title: 'Tenants',
    links: [
      { to: '/super-admin/organizations', icon: Building2, label: 'Organizations' },
      { to: '/super-admin/hostels', icon: GitFork, label: 'Hostel Properties' },
      { to: '/super-admin/users', icon: Users, label: 'Global Users' },
    ],
  },
  {
    title: 'Billing & Catalog',
    links: [
      { to: '/super-admin/plans', icon: CreditCard, label: 'Plans & Pricing' },
      { to: '/super-admin/subscriptions', icon: CreditCard, label: 'Subscriptions' },
      { to: '/super-admin/vouchers', icon: Ticket, label: 'Coupons & Vouchers' },
      { to: '/super-admin/features', icon: ToggleLeft, label: 'Feature Catalog' },
    ],
  },
  {
    title: 'Governance',
    links: [
      { to: '/super-admin/audit-logs', icon: ShieldAlert, label: 'Audit Logs' },
      { to: '/super-admin/security', icon: Lock, label: 'Security Center' },
      { to: '/super-admin/impersonation', icon: UserCheck, label: 'Impersonation' },
      { to: '/super-admin/system-health', icon: Activity, label: 'System Health' },
      { to: '/super-admin/reports', icon: FileDown, label: 'Reports & Exports' },
      { to: '/super-admin/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

interface SuperAdminLayoutProps {
  children: ReactNode;
  title: string;
}

export function SuperAdminLayout({ children, title }: SuperAdminLayoutProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const {
    isMobileOpen,
    closeMobile,
    toggleMobile,
    isCollapsed,
    toggleCollapse,
  } = useSidebarDrawer();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <PortalShell
      portalName="Hosteliq Platform"
      portalSubtitle="Super Admin"
      homeRoute="/super-admin/dashboard"
      pageTitle={title}
      pageSubtitle="SaaS Governance & Platform Operations"
      breadcrumbSection="Platform"
      sections={SUPER_ADMIN_NAV_SECTIONS}
      userName={user?.name || 'Super Administrator'}
      userEmail={user?.email || 'superadmin@hosteliq.in'}
      userRoleLabel="Platform Owner"
      welcomeSubtext="Global Governance Suite"
      profileRoute="/super-admin/settings"
      onLogout={handleLogout}
      isCollapsed={isCollapsed}
      onToggleCollapse={toggleCollapse}
      isMobileOpen={isMobileOpen}
      onToggleMobile={toggleMobile}
      onCloseMobile={closeMobile}
      sidebarAriaLabel="Super Admin Navigation"
    >
      {children}
    </PortalShell>
  );
}
