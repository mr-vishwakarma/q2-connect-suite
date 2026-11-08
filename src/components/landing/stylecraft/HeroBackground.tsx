import { useState } from 'react';

export interface HeroBackgroundProps {
  /**
   * Configurable background image path or URL.
   * Defaults to the local asset /assets/hero-modern-lounge.jpg.
   * Can be easily swapped when final hostel photography is provided.
   */
  imageSrc?: string;
  altText?: string;
  overlayOpacity?: number;
}

export function HeroBackground({
  imageSrc = '/assets/hero-modern-lounge.jpg',
  altText = 'Modern hostel lounge interior with minimalist architecture, comfortable seating, warm lighting and indoor plants',
  overlayOpacity = 0.55,
}: HeroBackgroundProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className="absolute inset-0 w-full h-full select-none pointer-events-none overflow-hidden">
      {/* Fallback solid background while image loads */}
      <div className="absolute inset-0 bg-[#16181B]" />

      {/* Hero Image */}
      <img
        src={imageSrc}
        alt={altText}
        loading="eager"
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        className={`w-full h-full object-cover object-center transition-opacity duration-700 ease-out ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Multi-layered cinematic gradient overlays for optimal text readability */}
      {/* Top gradient for navbar readability */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/75 via-black/40 to-transparent" />

      {/* Center uniform overlay for high-contrast headline readability */}
      <div
        className="absolute inset-0 bg-black"
        style={{ opacity: overlayOpacity }}
      />

      {/* Bottom ambient gradient to ground the floor */}
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
    </div>
  );
}
