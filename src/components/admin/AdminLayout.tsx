import { ReactNode } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopBar } from './AdminTopBar';
import { HostelProvider } from '@/contexts/HostelContext';

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
}

export function AdminLayout({ children, title }: AdminLayoutProps) {
  return (
    <HostelProvider>
      <div className="min-h-screen bg-background">
        <AdminSidebar />
        <div className="ml-64">
          <AdminTopBar title={title} />
          <main className="p-6">
            {children}
          </main>
        </div>
      </div>
    </HostelProvider>
  );
}
