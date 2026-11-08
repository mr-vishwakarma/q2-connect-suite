import { useState, useEffect } from 'react';
import { StylecraftHero } from './StylecraftHero';
import { LeadCaptureModal } from '@/components/landing/v2/LeadCaptureModal';

export interface StylecraftLandingPageProps {
  heroImageSrc?: string;
}

export function StylecraftLandingPage({ heroImageSrc }: StylecraftLandingPageProps) {
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);

  useEffect(() => {
    document.title = 'Hostel IQ — A Smarter Way to Manage Your Hostel';
  }, []);

  return (
    <div className="min-h-screen lg:h-screen w-full bg-[#E2E6EA] flex items-center justify-center p-2.5 sm:p-3.5 md:p-4 lg:p-5 box-border overflow-hidden antialiased font-sans selection:bg-[#E8503A] selection:text-white">
      {/* 
        The Centered White Outer Container with Generously Rounded Corners
        In full-screen mode, this fills the screen proportionally, framing the hero with an even white border.
      */}
      <main className="w-full h-full max-w-[1680px] flex-1 flex flex-col bg-white rounded-[26px] sm:rounded-[34px] md:rounded-[40px] p-2 sm:p-2.5 md:p-3 lg:p-3.5 shadow-[0_25px_60px_-15px_rgba(15,23,42,0.12)] border border-white/80 transition-all duration-300 overflow-hidden">
        <StylecraftHero
          imageSrc={heroImageSrc}
          onConnect={() => setIsLeadModalOpen(true)}
        />
      </main>

      {/* Global Lead Capture / "Connect With Us" Modal */}
      <LeadCaptureModal
        isOpen={isLeadModalOpen}
        onClose={() => setIsLeadModalOpen(false)}
      />
    </div>
  );
}
