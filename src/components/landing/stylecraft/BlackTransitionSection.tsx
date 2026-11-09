export function BlackTransitionSection() {
  return (
    <section
      className="relative w-full overflow-hidden select-none pointer-events-none"
      aria-label="Transition Stage"
    >
      {/* 
        Top Transition Gradient:
        Smoothly blends from the hero stage's soft grey (#E2E6EA) into pure black (#050505).
      */}
      <div className="w-full h-32 sm:h-48 md:h-64 bg-gradient-to-b from-[#E2E6EA] via-[#101216] to-[#050505]" />

      {/* 
        Main Deep Black Transition Body:
        Minimal, spacious, pure atmospheric black stage with comfortable scroll distance.
      */}
      <div className="w-full h-[60vh] sm:h-[75vh] md:h-[85vh] bg-[#050505] flex items-center justify-center relative">
        {/* Subtle, soft ambient radial glow to add cinematic depth without clutter */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.03)_0%,transparent_70%)]" />
      </div>

      {/* 
        Bottom Transition Gradient:
        Smoothly transitions from deep black (#050505) into the white background (#FFFFFF) of the scroll animation.
      */}
      <div className="w-full h-32 sm:h-48 md:h-64 bg-gradient-to-b from-[#050505] via-[#202020]/20 to-white" />
    </section>
  );
}
