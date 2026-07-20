import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useSidebarDrawer } from '@/hooks/useSidebarDrawer';
import { AnimatePresence, motion } from 'framer-motion';
import { SmartChatbot } from '@/components/chatbot/SmartChatbot';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  isAdmin?: boolean;
}

export function DashboardLayout({ children, title, isAdmin = false }: DashboardLayoutProps) {
  const { isOpen, setIsOpen, toggle, shouldOverlay, isCollapsed, toggleCollapse } = useSidebarDrawer();

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      {!shouldOverlay && (
        <div className={`fixed left-0 top-0 h-screen transition-all duration-300 z-30 ${isCollapsed ? 'w-20' : 'w-64'}`}>
          <Sidebar isAdmin={isAdmin} isCollapsed={isCollapsed} onToggleCollapse={toggleCollapse} />
        </div>
      )}

      {/* Mobile/Tablet Overlay */}
      <AnimatePresence>
        {shouldOverlay && isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
              className="fixed left-0 top-0 h-screen w-64 z-50"
            >
              <Sidebar isAdmin={isAdmin} onNavigate={() => setIsOpen(false)} isCollapsed={false} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className={`transition-all duration-300 ${shouldOverlay ? '' : isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <TopBar title={title} onMenuToggle={toggle} showMenu={shouldOverlay} />
        <main className="p-3 sm:p-4 md:p-6">
          {children}
        </main>
      </div>
      <SmartChatbot isAdmin={isAdmin} />
    </div>
  );
}
