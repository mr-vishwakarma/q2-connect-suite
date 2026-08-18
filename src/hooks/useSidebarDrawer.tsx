import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

const DESKTOP_BREAKPOINT = 1024;

export function useSidebarDrawer() {
  const location = useLocation();

  // Mobile/Tablet drawer open state (defaults to closed)
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Desktop sidebar collapsed state (persisted in localStorage)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') === 'true';
    }
    return false;
  });

  // Track if viewport is desktop (>= 1024px)
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= DESKTOP_BREAKPOINT;
    }
    return true;
  });

  useEffect(() => {
    const handleResize = () => {
      const desktop = window.innerWidth >= DESKTOP_BREAKPOINT;
      setIsDesktop(desktop);
      // If resizing to desktop, close mobile drawer
      if (desktop) {
        setIsMobileOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Synchronize route changes: ALWAYS close mobile drawer on navigation
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  const closeMobile = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  const openMobile = useCallback(() => {
    setIsMobileOpen(true);
  }, []);

  const toggleMobile = useCallback(() => {
    setIsMobileOpen((prev) => !prev);
  }, []);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('sidebar-collapsed', String(next));
      }
      return next;
    });
  }, []);

  return {
    isOpen: isMobileOpen,
    isMobileOpen,
    openMobile,
    closeMobile,
    toggleMobile,
    closeSidebar: closeMobile,
    isCollapsed,
    toggleCollapse,
    isDesktop,
    shouldOverlay: !isDesktop,
    toggle: toggleMobile,
  };
}
