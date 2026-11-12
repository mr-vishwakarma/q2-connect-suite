import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarCheck,
  LayoutDashboard,
  Lightbulb,
  MessageSquare,
  Shirt,
  User,
  UtensilsCrossed,
} from 'lucide-react';
import { MobileBottomNav } from './MobileBottomNav';
import { useSidebarDrawer } from '@/hooks/useSidebarDrawer';
import { useAuth } from '@/hooks/useAuth';
import { SmartChatbot } from '@/components/chatbot/SmartChatbot';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { PortalNavSection, PortalShell } from '@/components/layout/PortalShell';

const STUDENT_NAV_SECTIONS: PortalNavSection[] = [
  {
    title: 'Overview',
    links: [
      { to: '/student/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/student/fee-history', icon: CalendarCheck, label: 'Fee History' },
    ],
  },
  {
    title: 'Hostel Services',
    links: [
      { to: '/student/laundry', icon: Shirt, label: 'Laundry Booking' },
      { to: '/student/mess-off', icon: UtensilsCrossed, label: 'Leave Requests' },
      { to: '/student/complaints', icon: MessageSquare, label: 'Complaints' },
      { to: '/student/suggestions', icon: Lightbulb, label: 'Suggestions' },
    ],
  },
  {
    title: 'Account',
    links: [
      { to: '/student/profile', icon: User, label: 'My Profile' },
    ],
  },
];

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  isAdmin?: boolean;
}

export function DashboardLayout({ children, title, isAdmin = false }: DashboardLayoutProps) {
  const { user, profile, signOut } = useAuth();
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
    navigate('/');
  };

  const displayName = profile?.name || user?.name || 'Resident';
  const roomSummary = profile?.room_no
    ? `Room ${profile.room_no}${profile?.hostel ? ` • ${profile.hostel}` : ''}`
    : `${profile?.hostel || 'Hosteliq'} Resident`;

  return (
    <PortalShell
      portalName="Student Portal"
      portalSubtitle="Resident Suite"
      homeRoute="/student/dashboard"
      pageTitle={title}
      pageSubtitle={roomSummary}
      breadcrumbSection="Resident"
      sections={STUDENT_NAV_SECTIONS}
      userName={displayName}
      userEmail={profile?.email || user?.email || undefined}
      userAvatar={profile?.profilePhoto}
      userRoleLabel={isAdmin ? 'Administrator' : 'Hostel Resident'}
      welcomeSubtext={roomSummary}
      profileRoute="/student/profile"
      onLogout={handleLogout}
      isCollapsed={isCollapsed}
      onToggleCollapse={toggleCollapse}
      isMobileOpen={isMobileOpen}
      onToggleMobile={toggleMobile}
      onCloseMobile={closeMobile}
      sidebarAriaLabel="Student Portal Navigation"
      topBarRight={<NotificationBell />}
      bottomMobileNav={<MobileBottomNav />}
      floatingWidget={<SmartChatbot isAdmin={isAdmin} />}
    >
      {children}
    </PortalShell>
  );
}
