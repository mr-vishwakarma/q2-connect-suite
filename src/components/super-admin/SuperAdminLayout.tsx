import { ReactNode, useState } from 'react';
import { SuperAdminSidebar } from './SuperAdminSidebar';
import { SuperAdminTopBar } from './SuperAdminTopBar';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SuperAdminLayoutProps {
  children: ReactNode;
  title: string;
}

export function SuperAdminLayout({ children, title }: SuperAdminLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Desktop Fixed Sidebar */}
      <div className={cn('hidden lg:block fixed left-0 top-0 bottom-0 h-screen z-30 transition-all duration-300', isCollapsed ? 'w-20' : 'w-64')}>
        <SuperAdminSidebar
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed((prev) => !prev)}
        />
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-72 h-full z-50"
            >
              <SuperAdminSidebar
                isCollapsed={false}
                onToggleCollapse={() => {}}
                onClose={() => setIsMobileOpen(false)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className={cn('flex-1 transition-all duration-300 flex flex-col min-h-screen', isCollapsed ? 'lg:pl-20' : 'lg:pl-64')}>
        <SuperAdminTopBar title={title} onMenuToggle={() => setIsMobileOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
