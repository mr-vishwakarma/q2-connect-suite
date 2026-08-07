import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string; // e.g., 'text-primary'
  bg: string; // e.g., 'bg-primary/10'
  link?: string;
  index?: number;
  size?: 'sm' | 'default';
}

export function StatCard({ title, value, icon: Icon, color, bg, link, index = 0, size = 'default' }: StatCardProps) {
  const isSm = size === 'sm';
  
  const CardContentWrapper = (
    <Card className="hover:border-primary/50 transition-all duration-300 cursor-pointer group h-full">
      <CardContent className={isSm ? "p-3 sm:p-4 flex flex-col justify-center h-full" : "p-4 sm:p-6 flex flex-col justify-center h-full"}>
        <div className={`flex items-center ${isSm ? 'gap-2 sm:gap-3' : 'gap-3 sm:gap-4'}`}>
          <div className={`${isSm ? 'p-2' : 'p-2.5 sm:p-3'} rounded-xl sm:rounded-2xl ${bg} shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:-translate-y-1`}>
            <Icon className={`${isSm ? 'w-4 h-4 sm:w-5 sm:h-5' : 'w-5 h-5 sm:w-6 sm:h-6'} ${color}`} />
          </div>
          <div className="overflow-hidden">
            <p className={`text-xs ${!isSm && 'sm:text-sm'} text-muted-foreground whitespace-nowrap truncate`}>{title}</p>
            <p className={`${isSm ? 'text-base sm:text-lg lg:text-xl' : 'text-lg sm:text-3xl'} font-bold truncate ${color === 'text-foreground' || color === 'text-primary' ? 'text-foreground' : color}`}>{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const AnimatedWrapper = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
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
