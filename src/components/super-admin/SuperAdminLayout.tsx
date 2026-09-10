import { ReactNode, useEffect } from 'react';
import { SuperAdminSidebar } from './SuperAdminSidebar';
import { SuperAdminTopBar } from './SuperAdminTopBar';
import { useSidebarDrawer } from '@/hooks/useSidebarDrawer';
import { cn } from '@/lib/utils';

interface SuperAdminLayoutProps {
  children: ReactNode;
  title: string;
}

export function SuperAdminLayout({ children, title }: SuperAdminLayoutProps) {
  const {
    isMobileOpen,
    closeMobile,
    toggleMobile,
    isCollapsed,
    toggleCollapse,
  } = useSidebarDrawer();

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileOpen) {
        closeMobile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen, closeMobile]);

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Desktop Fixed Sidebar */}
      <div className={cn('hidden lg:block fixed left-0 top-0 bottom-0 h-screen z-30 transition-all duration-300', isCollapsed ? 'w-20' : 'w-64')}>
        <SuperAdminSidebar
          isCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapse}
        />
      </div>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Visible backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-200"
            onClick={closeMobile}
            aria-hidden="true"
          />

          {/* Slide-in mobile drawer */}
          <aside
            id="super-admin-sidebar"
            className="fixed left-0 top-0 bottom-0 w-72 max-w-[85vw] h-full bg-card border-r border-border shadow-2xl flex flex-col z-50 animate-in slide-in-from-left duration-250 ease-out"
            aria-label="Super Admin Mobile Navigation"
          >
            <SuperAdminSidebar
              isCollapsed={false}
              onToggleCollapse={() => {}}
              onClose={closeMobile}
            />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className={cn('flex-1 transition-all duration-300 flex flex-col min-h-screen', isCollapsed ? 'lg:pl-20' : 'lg:pl-64')}>
        <SuperAdminTopBar
          title={title}
          onMenuToggle={toggleMobile}
          isMenuOpen={isMobileOpen}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
