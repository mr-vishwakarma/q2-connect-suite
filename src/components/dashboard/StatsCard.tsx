import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: {
    value: string;
    positive: boolean;
  };
  className?: string;
}

export function StatsCard({ title, value, icon, trend, className }: StatsCardProps) {
  return (
    <div
      className={cn(
        "glass-card rounded-2xl p-5 sm:p-6 transition-all duration-200 hover:border-[rgba(210,195,255,0.22)]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-medium text-[#9295AD] mb-1.5 truncate">{title}</p>
          <p className="text-2xl sm:text-3xl font-bold text-[#F0EFF8] tracking-tight tabular-nums-clean">{value}</p>
          {trend && (
            <p className={cn(
              "text-xs sm:text-sm font-medium mt-2",
              trend.positive ? "text-[#74DCCB]" : "text-rose-400"
            )}>
              {trend.positive ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        <div className="w-11 h-11 rounded-xl bg-[#A78BFA]/15 border border-[#A78BFA]/25 flex items-center justify-center text-[#A78BFA] shrink-0">
          {icon}
        </div>
      </div>
    </div>
  );
}
