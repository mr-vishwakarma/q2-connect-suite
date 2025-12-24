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
    <div className={cn(
      "bg-card border border-border rounded-2xl p-6 shadow-card transition-all duration-200 hover:shadow-elevated",
      className
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <p className="text-3xl font-bold text-foreground">{value}</p>
          {trend && (
            <p className={cn(
              "text-sm mt-2",
              trend.positive ? "text-success" : "text-destructive"
            )}>
              {trend.positive ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
          {icon}
        </div>
      </div>
    </div>
  );
}
