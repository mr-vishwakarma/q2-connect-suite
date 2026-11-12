import React from 'react';
import { cn } from '@/lib/utils';

export interface HosteliqLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  variant?: 'full' | 'wordmark' | 'mark' | 'sidebar';
  subtitle?: string;
}

const wordmarkHeights = {
  sm: 'h-7 w-auto',
  md: 'h-9 w-auto',
  lg: 'h-11 w-auto',
  xl: 'h-14 w-auto',
} as const;

const markSizes = {
  sm: 'w-7 h-7',
  md: 'w-9 h-9',
  lg: 'w-11 h-11',
  xl: 'w-14 h-14',
} as const;

export const HosteliqLogo: React.FC<HosteliqLogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
  variant = 'wordmark',
  subtitle,
}) => {
  if (variant === 'mark' || (!showText && variant !== 'wordmark')) {
    return (
      <div className={cn('relative flex items-center justify-center shrink-0 select-none', markSizes[size], className)}>
        <img
          src="/favicon.svg"
          alt="Hosteliq"
          className="w-full h-full object-contain drop-shadow-[0_2px_10px_rgba(167,139,250,0.3)]"
          loading="eager"
          decoding="async"
        />
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col items-start justify-center select-none', className)}>
      <img
        src="/hosteliq-logo.png"
        alt="Hosteliq"
        className={cn(
          wordmarkHeights[size],
          'object-contain object-left drop-shadow-[0_4px_18px_rgba(167,139,250,0.22)]'
        )}
        loading="eager"
        decoding="async"
      />
      {subtitle && (
        <span className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[#9295AD] mt-1 pl-0.5 leading-none">
          {subtitle}
        </span>
      )}
    </div>
  );
};

export default HosteliqLogo;
