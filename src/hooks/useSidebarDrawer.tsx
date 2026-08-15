import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useIsMobile } from './use-mobile';

const TABLET_BREAKPOINT = 1024;

export function useIsTablet() {
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      setIsTablet(w >= 768 && w <= TABLET_BREAKPOINT);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isTablet;
}

export function useSidebarDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });
  
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const location = useLocation();
  const shouldOverlay = isMobile || isTablet;
  const hasMountedRef = useRef(false);

  // Close sidebar on every route change (skip initial mount)
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    setIsOpen(false);
  }, [location.pathname]);

  const closeSidebar = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  return {
    isOpen,
    setIsOpen,
    toggle: () => setIsOpen(prev => !prev),
    closeSidebar,
    isCollapsed,
    toggleCollapse,
    shouldOverlay,
    isMobile,
    isTablet,
  };
}
