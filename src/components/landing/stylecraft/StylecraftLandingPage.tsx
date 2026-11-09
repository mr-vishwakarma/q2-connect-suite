import { useState, useEffect } from 'react';
import { StylecraftHero } from './StylecraftHero';
import { BlackTransitionSection } from './BlackTransitionSection';
import { ScrollSequenceSection } from './ScrollSequenceSection';
import { LeadCaptureModal } from '@/components/landing/v2/LeadCaptureModal';
import defaultHeroLounge from '@/assets/hero-modern-lounge.jpg';

export interface StylecraftLandingPageProps {
  heroImageSrc?: string;
}

export function StylecraftLandingPage({ heroImageSrc }: StylecraftLandingPageProps) {
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);

  useEffect(() => {
    document.title = 'Hostel IQ — A Smarter Way to Manage Your Hostel';
  }, []);

  const activeImage = heroImageSrc || defaultHeroLounge || '/assets/hero-modern-lounge.jpg';

  return (
    <div className="w-full min-h-screen bg-[#E2E6EA] flex flex-col antialiased font-sans selection:bg-[#E8503A] selection:text-white">
      {/* 
        STAGE 1: EXISTING HERO SECTION
        - Initial full-viewport presentation (100dvh)
        - Preserves existing Hosteliq logo, navbar, and modern lounge hero background
        - Smoothly scrolls into the black transition section
      */}
      <div className="w-full min-h-[100dvh] flex flex-col items-center justify-start sm:justify-center p-1.5 sm:p-3 md:p-4 lg:p-5 box-border relative z-10">
        <main className="w-full h-[calc(100dvh-12px)] sm:h-[calc(100dvh-24px)] md:h-[calc(100dvh-40px)] max-w-[1680px] flex-1 flex flex-col bg-white rounded-[20px] xs:rounded-[24px] sm:rounded-[34px] md:rounded-[40px] p-1.5 sm:p-2.5 md:p-3 lg:p-3.5 shadow-[0_25px_60px_-15px_rgba(15,23,42,0.12)] border border-white/80 transition-all duration-300 overflow-hidden">
          <StylecraftHero
            imageSrc={activeImage}
            onConnect={() => setIsLeadModalOpen(true)}
          />
        </main>
      </div>

      {/* 
        STAGE 2: BLACK BACKGROUND TRANSITION
        - Minimal, pure deep black transition section (#050505)
        - Cinematic visual pause between hero and the architectural sequence
      */}
      <BlackTransitionSection />

      {/* 
        STAGE 3: WHITE SCROLL-SCRUBBED ARCHITECTURAL PNG ANIMATION
        - Full viewport width, pure white background (#FFFFFF)
        - High-performance HTML Canvas sequence engine (240 frames)
        - Responsive aspect ratio preservation (405x720) with DPR support
        - Sticky pinning across scroll distance with bidirectional scrubbing
      */}
      <ScrollSequenceSection />

      {/* Global Lead Capture / "Connect With Us" Modal */}
      <LeadCaptureModal
        isOpen={isLeadModalOpen}
        onClose={() => setIsLeadModalOpen(false)}
      />
    </div>
  );
}
