import { useEffect } from 'react';
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Visible backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in mobile drawer */}
      <aside
        id="admin-sidebar"
        className="fixed left-0 top-0 bottom-0 w-72 max-w-[85vw] h-full bg-sidebar border-r border-sidebar-border shadow-2xl flex flex-col z-50 animate-in slide-in-from-left duration-250 ease-out"
        aria-label="Mobile Navigation"
      >
        <SidebarHeader isCollapsed={false} onClose={onClose} />
        <SidebarNavigation isCollapsed={false} onNavigate={onClose} />
        <SidebarFooter isCollapsed={false} onNavigate={onClose} />
      </aside>
    </div>
  );
}
