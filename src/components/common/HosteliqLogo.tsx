import React from 'react';

interface HosteliqLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  variant?: 'full' | 'mark';
}

export const HosteliqLogo: React.FC<HosteliqLogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
  variant = 'full',
}) => {
  const sizeMap = {
    sm: { img: 'w-7 h-7', text: 'text-base', sub: 'text-[9px]' },
    md: { img: 'w-9 h-9', text: 'text-lg', sub: 'text-[10px]' },
    lg: { img: 'w-11 h-11', text: 'text-xl', sub: 'text-[11px]' },
    xl: { img: 'w-14 h-14', text: 'text-2xl', sub: 'text-xs' },
  };

  const currentSize = sizeMap[size];

  if (variant === 'mark' || !showText) {
    return (
      <div className={`relative flex items-center justify-center shrink-0 ${currentSize.img} ${className}`}>
        <img
          src="/hosteliq-logo.png"
          alt="Hosteliq"
          className="w-full h-full object-contain"
          loading="eager"
          decoding="async"
        />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <div className={`relative flex items-center justify-center shrink-0 ${currentSize.img}`}>
        <img
          src="/hosteliq-logo.png"
          alt="Hosteliq Mark"
          className="w-full h-full object-contain"
          loading="eager"
          decoding="async"
        />
      </div>
      <div className="flex flex-col text-left">
        <span className={`font-black tracking-tight leading-none text-foreground flex items-center ${currentSize.text}`}>
          <span className="text-[#9d78d2]">Hostel</span>
          <span className="text-[#2dd4bf]">i</span>
          <span className="text-[#fb7185]">q</span>
        </span>
        <span className={`font-semibold tracking-wider uppercase text-muted-foreground mt-0.5 ${currentSize.sub}`}>
          Accommodation Suite
        </span>
      </div>
    </div>
  );
};

export default HosteliqLogo;
