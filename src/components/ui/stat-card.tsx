import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  bg: string;
  link?: string;
  index?: number;
  size?: 'sm' | 'default';
}

export function StatCard({ title, value, icon: Icon, color, bg, link, index = 0, size = 'default' }: StatCardProps) {
  const isSm = size === 'sm';

  const CardContentWrapper = (
    <Card className="glass-card hover:border-[rgba(210,195,255,0.22)] hover:bg-[#191B26]/95 transition-all duration-200 cursor-pointer group h-full">
      <CardContent className={isSm ? "p-3.5 sm:p-4 flex flex-col justify-center h-full" : "p-4 sm:p-6 flex flex-col justify-center h-full"}>
        <div className={cn("flex items-center", isSm ? "gap-2.5 sm:gap-3" : "gap-3.5 sm:gap-4")}>
          <div className={cn(
            isSm ? "p-2.5 rounded-xl" : "p-3 rounded-xl",
            bg,
            "border border-white/[0.08] transition-transform duration-200 group-hover:-translate-y-0.5 shrink-0"
          )}>
            <Icon className={cn(isSm ? "w-4 h-4 sm:w-5 sm:h-5" : "w-5 h-5 sm:w-6 sm:h-6", color)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn("text-xs text-[#9295AD] whitespace-nowrap truncate font-medium", !isSm && "sm:text-sm")}>{title}</p>
            <p className={cn(
              isSm ? "text-base sm:text-lg" : "text-xl sm:text-2xl lg:text-[26px]",
              "font-bold tracking-tight tabular-nums-clean truncate mt-0.5",
              color === 'text-foreground' || color === 'text-primary' ? 'text-[#F0EFF8]' : color
            )}>
              {value}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const AnimatedWrapper = (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.06, 0.3) }}
      className="h-full"
    >
      {CardContentWrapper}
    </motion.div>
  );

  if (link) {
    return (
      <Link to={link} className="block h-full cursor-pointer">
        {AnimatedWrapper}
      </Link>
    );
  }

  return AnimatedWrapper;
}
