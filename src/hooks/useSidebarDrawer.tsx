import { useState, useEffect } from 'react';
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
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const location = useLocation();
  const shouldOverlay = isMobile || isTablet;

  // Auto-close on route change (mobile/tablet)
  useEffect(() => {
    if (shouldOverlay) {
      setIsOpen(false);
    }
  }, [location.pathname, shouldOverlay]);

  return {
    isOpen,
    setIsOpen,
    toggle: () => setIsOpen(prev => !prev),
    shouldOverlay,
    isMobile,
    isTablet,
  };
}
