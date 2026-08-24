import { ReactNode } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { AdminMobileDrawer } from './sidebar/AdminMobileDrawer';
import { AdminTopBar } from './AdminTopBar';
import { ImpersonationBanner } from './ImpersonationBanner';
import { useSidebarDrawer } from '@/hooks/useSidebarDrawer';
import { SmartChatbot } from '@/components/chatbot/SmartChatbot';
import { cn } from '@/lib/utils';

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
}

export function AdminLayout({ children, title }: AdminLayoutProps) {
  const {
    isMobileOpen,
    closeMobile,
    toggleMobile,
    isCollapsed,
    toggleCollapse,
  } = useSidebarDrawer();

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <ImpersonationBanner />
      {/* Desktop Persistent Sidebar (>= 1024px) */}
      <div
        className={cn(
          "hidden lg:block fixed left-0 top-0 bottom-0 h-screen z-30 transition-all duration-300",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        <AdminSidebar
          isCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapse}
        />
      </div>

      {/* Mobile/Tablet Drawer Overlay (< 1024px) */}
      <AdminMobileDrawer
        isOpen={isMobileOpen}
        onClose={closeMobile}
      />

      {/* Main Content Area */}
      <div
        className={cn(
          "transition-all duration-300 min-h-screen flex flex-col",
          isCollapsed ? "lg:pl-20" : "lg:pl-64"
        )}
      >
        <AdminTopBar
          title={title}
          onMenuToggle={toggleMobile}
          isMenuOpen={isMobileOpen}
          showMenu={true}
        />
        <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden">
          {children}
        </main>
      </div>

      <SmartChatbot isAdmin />
    </div>
  );
}
