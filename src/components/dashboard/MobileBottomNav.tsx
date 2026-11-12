import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, CalendarCheck, Shirt, CalendarOff, MessageSquare, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export function MobileBottomNav() {
  const location = useLocation();

  const links = [
    { to: '/student/dashboard', icon: LayoutDashboard, label: 'Home' },
    { to: '/student/laundry', icon: Shirt, label: 'Laundry' },
    { to: '/student/mess-off', icon: CalendarOff, label: 'Leave' },
    { to: '/student/fee-history', icon: CalendarCheck, label: 'Fees' },
    { to: '/student/complaints', icon: MessageSquare, label: 'Issues' },
    { to: '/student/suggestions', icon: Lightbulb, label: 'Ideas' },
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 h-16 bg-[#10121E]/95 backdrop-blur-xl border-t border-white/[0.08] z-40 flex items-center justify-around px-1 pb-safe lg:hidden shadow-[0_-8px_28px_rgba(4,6,12,0.75)]"
    >
      {links.map((link) => {
        const isActive = location.pathname === link.to;
        return (
          <Link
            key={link.to}
            to={link.to}
            className={cn(
              'flex flex-col items-center justify-center h-full space-y-1 relative active:scale-95 transition-colors flex-1 min-w-0',
              isActive ? 'text-[#F0EFF8]' : 'text-[#9295AD] hover:text-[#F0EFF8]',
            )}
          >
            {isActive && (
              <motion.div
                layoutId="bottomNavIndicator"
                className="absolute top-0 w-7 h-1 rounded-b-full bg-gradient-to-r from-[#A78BFA] to-[#ED91C1] shadow-[0_2px_10px_rgba(167,139,250,0.65)]"
                initial={false}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            <link.icon className={cn('w-4 h-4 sm:w-5 sm:h-5', isActive && 'text-[#A78BFA]')} />
            <span className="text-[10px] font-medium truncate w-full text-center px-0.5">
              {link.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
