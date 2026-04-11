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
  const { isOpen, setIsOpen, toggle, shouldOverlay } = useSidebarDrawer();

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      {!shouldOverlay && (
        <AdminSidebar />
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
              <AdminSidebar onNavigate={() => setIsOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className={shouldOverlay ? '' : 'ml-64'}>
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
