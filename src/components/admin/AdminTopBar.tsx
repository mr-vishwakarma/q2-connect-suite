import { useAuth } from '@/hooks/useAuth';
import { HostelSelector } from './HostelSelector';
import { Bell, Settings, Menu } from 'lucide-react';
import { motion } from 'framer-motion';

interface AdminTopBarProps {
  title: string;
  onMenuToggle?: () => void;
  showMenu?: boolean;
}

export function AdminTopBar({ title, onMenuToggle, showMenu }: AdminTopBarProps) {
  const { profile } = useAuth();

  return (
    <header className="h-14 sm:h-16 bg-card border-b border-border flex items-center justify-between px-3 sm:px-6 sticky top-0 z-30">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        {showMenu && (
          <button
            onClick={onMenuToggle}
            className="p-2 rounded-lg text-foreground hover:bg-secondary transition-colors shrink-0"
            aria-label="Toggle menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-sm sm:text-xl font-bold text-foreground truncate max-w-[100px] sm:max-w-none">{title}</h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <HostelSelector />
        <span className="text-foreground font-medium hidden lg:block text-sm">
          {profile?.name || 'Admin'}
        </span>
        <motion.button 
          whileHover={{ scale: 1.1 }}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors hidden sm:flex"
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
