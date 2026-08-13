import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileBottomNav } from './MobileBottomNav';
import { useSidebarDrawer } from '@/hooks/useSidebarDrawer';
import { AnimatePresence, motion } from 'framer-motion';
import { SmartChatbot } from '@/components/chatbot/SmartChatbot';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  isAdmin?: boolean;
}

export function DashboardLayout({ children, title, isAdmin = false }: DashboardLayoutProps) {
  const { shouldOverlay, isCollapsed, toggleCollapse } = useSidebarDrawer();

  return (
    <div className="min-h-screen bg-background md:pb-0 pb-16">
      {/* Desktop Sidebar */}
      {!shouldOverlay && (
        <div className={`fixed left-0 top-0 h-screen transition-all duration-300 z-30 ${isCollapsed ? 'w-20' : 'w-64'}`}>
          <Sidebar isAdmin={isAdmin} isCollapsed={isCollapsed} onToggleCollapse={toggleCollapse} />
        </div>
      )}

      <div className={`transition-all duration-300 ${shouldOverlay ? '' : isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <TopBar title={title} showMenu={false} />
        <main className="p-3 sm:p-4 md:p-6">
          {children}
        </main>
      </div>
      
      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
      
      <SmartChatbot isAdmin={isAdmin} />
    </div>
  );
}
