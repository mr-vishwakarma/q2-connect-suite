import { useAuth } from '@/hooks/useAuth';
import { HostelSelector } from './HostelSelector';
import { Bell, Settings } from 'lucide-react';
import { motion } from 'framer-motion';

interface AdminTopBarProps {
  title: string;
}

export function AdminTopBar({ title }: AdminTopBarProps) {
  const { profile } = useAuth();

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6">
      <div className="flex items-center gap-6">
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
        <HostelSelector />
      </div>

      <div className="flex items-center gap-4">
        <span className="text-foreground font-medium">
          {profile?.name || 'Admin'}
        </span>
        <motion.button 
          whileHover={{ scale: 1.1 }}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <Settings className="w-5 h-5" />
        </motion.button>
        <motion.button 
          whileHover={{ scale: 1.1 }}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <Bell className="w-5 h-5" />
        </motion.button>
      </div>
    </header>
  );
}
