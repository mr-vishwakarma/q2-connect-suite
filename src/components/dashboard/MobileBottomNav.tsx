import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, CalendarCheck, Shirt, CalendarOff, MessageSquare, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export function MobileBottomNav({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const location = useLocation();

  const links = [
    { to: '/student/dashboard', icon: LayoutDashboard, label: 'Home' },
    { to: '/student/laundry', icon: Shirt, label: 'Laundry' },
    { to: '/student/leave', icon: CalendarOff, label: 'Leave' },
    { to: '/student/fee-history', icon: CalendarCheck, label: 'Fees' },
    { to: '/student/complaints', icon: MessageSquare, label: 'Complaints' },
    { to: '/student/suggestions', icon: Lightbulb, label: 'Suggestions' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border z-40 flex items-center justify-around px-1 pb-safe md:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
      {links.map((link) => {
        const isActive = location.pathname === link.to;
        return (
          <Link
            key={link.to}
            to={link.to}
            className={cn(
              "flex flex-col items-center justify-center h-full space-y-1 relative active:scale-95 transition-transform flex-1",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {isActive && (
              <motion.div
                layoutId="bottomNavIndicator"
                className="absolute top-0 w-8 h-1 rounded-b-full bg-primary"
                initial={false}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            <link.icon className={cn("w-4 h-4 sm:w-5 sm:h-5", isActive && "fill-primary/20")} />
            <span className="text-[9px] sm:text-[10px] font-medium truncate w-full text-center px-0.5">{link.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
