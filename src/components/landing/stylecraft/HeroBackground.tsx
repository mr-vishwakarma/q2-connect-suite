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
  imageSrc,
  altText = 'Modern hostel lounge interior with minimalist architecture, comfortable seating, warm lighting and indoor plants',
  overlayOpacity = 0.12,
}: HeroBackgroundProps) {
  // Triple-guarded image source resolution: prop -> imported asset -> public asset
  const resolvedSrc = imageSrc || defaultHeroLounge || '/assets/hero-modern-lounge.jpg';

  return (
    <div
      className="absolute inset-0 w-full h-full select-none pointer-events-none overflow-hidden bg-cover bg-center bg-no-repeat bg-[#2A2624]"
      style={{
        backgroundImage: `url(${resolvedSrc})`,
      }}
    >
      {/* 
        Native HTML <img> element:
        - Must have "absolute inset-0" to take exact dimensions without being hidden by stacking context
        - z-0 ensures it stays behind overlays (z-[1]) and on top of container background
        - decoding="sync" / fetchPriority="high" ensures instant frame-0 rendering
      */}
      <img
        src={resolvedSrc}
        alt={altText}
        loading="eager"
        fetchPriority="high"
        decoding="sync"
        className="absolute inset-0 w-full h-full object-cover object-center z-0"
        onError={(e) => {
          // If the bundled path ever fails, seamlessly fall back to public asset
          const target = e.currentTarget;
          if (target.src !== '/assets/hero-modern-lounge.jpg') {
            target.src = '/assets/hero-modern-lounge.jpg';
          }
        }}
      />

      {/* Subtle top vignette for navbar contrast (subtle, non-intrusive) */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/40 via-black/15 to-transparent z-[1]" />

      {/* Gentle center contrast wash so the warm room lighting stays bright and visible */}
      {overlayOpacity > 0 && (
        <div
          className="absolute inset-0 bg-black z-[1]"
          style={{ opacity: overlayOpacity }}
        />
      )}

      {/* Subtle bottom vignette to ground the floor */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/40 via-black/10 to-transparent z-[1]" />
    </div>
  );
}
