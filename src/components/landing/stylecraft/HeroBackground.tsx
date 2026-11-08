import defaultHeroLounge from '@/assets/hero-modern-lounge.jpg';

export interface HeroBackgroundProps {
  /**
   * Configurable background image path or URL.
   * Defaults to the bundled local asset hero-modern-lounge.jpg.
   * Can be easily swapped when final hostel photography is provided.
   */
  imageSrc?: string;
  altText?: string;
  overlayOpacity?: number;
}

export function HeroBackground({
  imageSrc = defaultHeroLounge,
  altText = 'Modern hostel lounge interior with minimalist architecture, comfortable seating, warm lighting and indoor plants',
  overlayOpacity = 0.22,
}: HeroBackgroundProps) {
  return (
    <div className="absolute inset-0 w-full h-full select-none pointer-events-none overflow-hidden">
      {/* Warm ambient fallback background */}
      <div className="absolute inset-0 bg-[#2A2624]" />

      {/* Hero Image — eager, high priority, and immediately visible on page load/refresh */}
      <img
        src={imageSrc}
        alt={altText}
        loading="eager"
        fetchPriority="high"
        decoding="async"
        className="w-full h-full object-cover object-center"
      />

      {/* Multi-layered cinematic gradient overlays for optimal text readability while keeping the room interior vibrant & visible */}
      {/* 1. Top vignette for navbar contrast */}
      <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/55 via-black/25 to-transparent" />

      {/* 2. Soft uniform overlay so the natural warm room lighting remains bright and vivid */}
      <div
        className="absolute inset-0 bg-black"
        style={{ opacity: overlayOpacity }}
      />

      {/* 3. Focused radial gradient behind the center headline for maximum text legibility */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.38)_0%,rgba(0,0,0,0.15)_50%,transparent_75%)]" />

      {/* 4. Bottom grounding vignette */}
      <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
    </div>
  );
}
