import { memo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { HostelSelector } from './HostelSelector';
import { Bell, Settings, Menu } from 'lucide-react';
import { motion } from 'framer-motion';

interface AdminTopBarProps {
  title: string;
  subtitle?: string;
  onMenuToggle?: () => void;
  isMenuOpen?: boolean;
  showMenu?: boolean;
}

function AdminTopBarInner({
  title,
  subtitle,
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
        <div className="flex flex-col min-w-0">
          <h1 className="text-sm sm:text-lg font-bold text-foreground truncate max-w-[150px] sm:max-w-none leading-tight">
            {title}
          </h1>
          {subtitle && (
            <span className="text-[11px] sm:text-xs text-muted-foreground font-normal leading-tight">
              {subtitle}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
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
          className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-card" />
        </motion.button>
      </div>
    </header>
  );
}

// Memo — title/subtitle prop changes drive re-renders, not auth state changes
export const AdminTopBar = memo(AdminTopBarInner);
