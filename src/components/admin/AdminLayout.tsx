import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Settings } from 'lucide-react';
import { HostelSelector } from './HostelSelector';
import { ImpersonationBanner } from './ImpersonationBanner';
import { ADMIN_NAV_SECTIONS } from './sidebar/adminNavLinks';
import { useSidebarDrawer } from '@/hooks/useSidebarDrawer';
import { useAuth } from '@/hooks/useAuth';
import { useHostel } from '@/contexts/HostelContext';
import { studentService } from '@/services/api';
import { SmartChatbot } from '@/components/chatbot/SmartChatbot';
import { PortalNavSection, PortalShell } from '@/components/layout/PortalShell';

const routePreloaders: Record<string, () => Promise<unknown>> = {
  '/admin/dashboard': () => import('@/pages/admin/AdminDashboard'),
  '/admin/students': () => import('@/pages/admin/AllStudents'),
  '/admin/fees': () => import('@/pages/admin/FeeManagement'),
  '/admin/rooms': () => import('@/pages/admin/RoomManagement'),
  '/admin/attendance': () => import('@/pages/admin/AttendanceManagement'),
  '/admin/billing': () => import('@/pages/admin/Billing'),
};
const prefetchedRoutes = new Set<string>();

function prefetchRoute(to: string) {
  if (prefetchedRoutes.has(to)) return;
  const loader = routePreloaders[to];
  if (loader) {
    prefetchedRoutes.add(to);
    loader().catch(() => {
      prefetchedRoutes.delete(to);
    });
  }
}

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function AdminLayout({ children, title, subtitle }: AdminLayoutProps) {
  const { user, profile, isAdmin, hasFeature, signOut } = useAuth();
  const { selectedHostel, currentBranch } = useHostel();
  const navigate = useNavigate();
  const [alertCount, setAlertCount] = useState(0);

  const {
    isMobileOpen,
    closeMobile,
    toggleMobile,
    isCollapsed,
    toggleCollapse,
  } = useSidebarDrawer();

  const fetchAlertCount = useCallback(async () => {
    try {
      const response = await studentService.getAlertsCount({ hostel: selectedHostel });
      if (response.success) {
        const count = response.data?.count ?? response.count ?? 0;
        setAlertCount(count);
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

  const sections: PortalNavSection[] = useMemo(
    () =>
      ADMIN_NAV_SECTIONS.map((sec) => ({
        title: sec.title,
        links: sec.links
          .filter((link) => !link.featureKey || hasFeature(link.featureKey))
          .map((link) => ({
            ...link,
            badge: link.to === '/admin/alerts' ? alertCount : undefined,
          })),
      })).filter((sec) => sec.links.length > 0),
    [hasFeature, alertCount],
  );

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const displayName = profile?.name || user?.name || 'Hostel Manager';
  const branchSummary = currentBranch?.name || `${selectedHostel || 'Hosteliq'} Branch`;

  return (
    <PortalShell
      portalName="Hostel Admin"
      portalSubtitle="Admin Portal"
      homeRoute="/admin/dashboard"
      pageTitle={title}
      pageSubtitle={subtitle}
      breadcrumbSection="Overview"
      sections={sections}
      userName={displayName}
      userEmail={profile?.email || user?.email || undefined}
      userAvatar={profile?.profilePhoto}
      userRoleLabel="Hostel Administrator"
      welcomeSubtext={branchSummary}
      profileRoute="/admin/settings"
      onLogout={handleLogout}
      isCollapsed={isCollapsed}
      onToggleCollapse={toggleCollapse}
      isMobileOpen={isMobileOpen}
      onToggleMobile={toggleMobile}
      onCloseMobile={closeMobile}
      onLinkHover={prefetchRoute}
      topBanner={<ImpersonationBanner />}
      sidebarAriaLabel="Admin Navigation"
      topBarRight={
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <HostelSelector />
          <Link
            to="/admin/settings"
            className="hidden sm:flex items-center justify-center w-9 h-9 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-[#9295AD] hover:text-[#F0EFF8] transition-colors"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>
          <Link
            to="/admin/notifications"
            className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-[#9295AD] hover:text-[#F0EFF8] transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {alertCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-400 ring-2 ring-[#10121E]" />
            )}
          </Link>
        </div>
      }
      floatingWidget={<SmartChatbot isAdmin />}
    >
      {children}
    </PortalShell>
  );
}
