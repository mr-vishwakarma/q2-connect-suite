import { ReactNode } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopBar } from './AdminTopBar';
import { useSidebarDrawer } from '@/hooks/useSidebarDrawer';
import { AnimatePresence, motion } from 'framer-motion';
import { SmartChatbot } from '@/components/chatbot/SmartChatbot';

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
}

function AdminLayoutInner({ children, title }: AdminLayoutProps) {
  const { isOpen, toggle, closeSidebar, isCollapsed, toggleCollapse, shouldOverlay } = useSidebarDrawer();

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      {!shouldOverlay && (
        <div className={`fixed left-0 top-0 h-screen transition-all duration-300 z-30 ${isCollapsed ? 'w-20' : 'w-64'}`}>
          <AdminSidebar isCollapsed={isCollapsed} onToggleCollapse={toggleCollapse} />
        </div>
      )}

      {/* Mobile/Tablet Collapsible Sidebar (No dark modal backdrop) */}
      <AnimatePresence>
        {shouldOverlay && isOpen && (
          <motion.div
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 280 }}
            className="fixed left-0 top-0 h-screen w-64 z-50 shadow-2xl"
          >
            <AdminSidebar onNavigate={closeSidebar} isCollapsed={false} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`transition-all duration-300 ${shouldOverlay ? '' : isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <AdminTopBar title={title} onMenuToggle={toggle} showMenu={shouldOverlay} />
        <main className="p-3 sm:p-4 md:p-6">
          {children}
        </main>
      </div>
      
      <SmartChatbot isAdmin />
    </div>
  );
}

export function AdminLayout({ children, title }: AdminLayoutProps) {
  return (
    <AdminLayoutInner title={title}>
      {children}
    </AdminLayoutInner>
  );
}
