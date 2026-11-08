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
  overlayOpacity = 0.32,
}: HeroBackgroundProps) {
  return (
    <div className="absolute inset-0 w-full h-full select-none pointer-events-none overflow-hidden">
      {/* Fallback solid background while image loads */}
      <div className="absolute inset-0 bg-[#16181B]" />

      {/* Hero Image — rendered eagerly and persistently so it never disappears or flashes black on refresh */}
      <img
        src={imageSrc}
        alt={altText}
        loading="eager"
        fetchPriority="high"
        decoding="async"
        className="w-full h-full object-cover object-center"
      />

      {/* Multi-layered cinematic gradient overlays for optimal text readability while keeping the room interior vibrant */}
      {/* Top subtle vignette for navbar readability */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/50 via-black/20 to-transparent" />

      {/* Center uniform overlay for high-contrast headline readability */}
      <div
        className="absolute inset-0 bg-black"
        style={{ opacity: overlayOpacity }}
      />

      {/* Bottom ambient gradient to ground the floor */}
      <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
    </div>
  );
}

