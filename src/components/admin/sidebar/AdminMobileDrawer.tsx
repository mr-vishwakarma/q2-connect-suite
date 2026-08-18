import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SidebarHeader } from './SidebarHeader';
import { SidebarNavigation } from './SidebarNavigation';
import { SidebarFooter } from './SidebarFooter';

export interface AdminMobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminMobileDrawer({ isOpen, onClose }: AdminMobileDrawerProps) {
  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Visible backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Slide-in mobile drawer */}
          <motion.aside
            id="admin-sidebar"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className="fixed left-0 top-0 bottom-0 w-72 max-w-[85vw] h-full bg-sidebar border-r border-sidebar-border shadow-2xl flex flex-col z-50"
            aria-label="Mobile Navigation"
          >
            <SidebarHeader isCollapsed={false} onClose={onClose} />
            <SidebarNavigation isCollapsed={false} onNavigate={onClose} />
            <SidebarFooter isCollapsed={false} onNavigate={onClose} />
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
