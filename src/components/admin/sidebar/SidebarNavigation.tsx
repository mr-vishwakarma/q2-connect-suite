import { useCallback, useEffect, useState, useMemo, memo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useHostel } from '@/contexts/HostelContext';
import { studentService } from '@/services/api';
import { SidebarNavItem } from './SidebarNavItem';
import { ADMIN_NAV_LINKS } from './adminNavLinks';

export interface SidebarNavigationProps {
  isCollapsed?: boolean;
  onNavigate?: () => void;
}

function SidebarNavigationInner({ isCollapsed = false, onNavigate }: SidebarNavigationProps) {
  const { user, isAdmin, hasFeature } = useAuth();
  const { selectedHostel } = useHostel();
  const [alertCount, setAlertCount] = useState(0);

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

  // Only recompute when hasFeature reference changes (i.e. when auth state changes)
  const visibleLinks = useMemo(() =>
    ADMIN_NAV_LINKS.filter((link) => {
      if (!('featureKey' in link) || !link.featureKey) return true;
      return hasFeature(link.featureKey);
    }),
  [hasFeature]);

  return (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
      {visibleLinks.map((link) => {
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

// Wrap in memo — sidebar nav should not re-render when layout toggles mobile drawer
export const SidebarNavigation = memo(SidebarNavigationInner);
