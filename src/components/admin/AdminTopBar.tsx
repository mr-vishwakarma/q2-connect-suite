import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { HostelSelector } from './HostelSelector';
import { Bell, Settings, Menu } from 'lucide-react';
import { motion } from 'framer-motion';

interface AdminTopBarProps {
  title: string;
  onMenuToggle?: () => void;
  isMenuOpen?: boolean;
  showMenu?: boolean;
}

export function AdminTopBar({
  title,
  onMenuToggle,
  isMenuOpen = false,
  showMenu = true,
}: AdminTopBarProps) {
  const { profile } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="h-14 sm:h-16 bg-card border-b border-border flex items-center justify-between px-3 sm:px-6 sticky top-0 z-20">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        {showMenu && (
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 rounded-lg text-foreground hover:bg-secondary transition-colors shrink-0"
            aria-label="Toggle navigation menu"
            aria-expanded={isMenuOpen}
            aria-controls="admin-sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-sm sm:text-xl font-bold text-foreground truncate max-w-[150px] sm:max-w-none">{title}</h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <HostelSelector />
        <span className="text-foreground font-medium hidden lg:block text-sm">
          {profile?.name || 'Admin'}
        </span>
        <motion.button 
          onClick={() => navigate('/admin/settings')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors hidden sm:flex"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5" />
        </motion.button>
        <motion.button 
          onClick={() => navigate('/admin/notifications')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
        </motion.button>
      </div>
    </header>
  );
}
