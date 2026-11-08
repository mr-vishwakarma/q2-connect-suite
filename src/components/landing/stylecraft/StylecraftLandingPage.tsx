import { useState, useEffect } from 'react';
import { StylecraftHero } from './StylecraftHero';
import { LeadCaptureModal } from '@/components/landing/v2/LeadCaptureModal';

export interface StylecraftLandingPageProps {
  heroImageSrc?: string;
}

export function StylecraftLandingPage({ heroImageSrc }: StylecraftLandingPageProps) {
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);

  useEffect(() => {
    document.title = 'Hosteliq — A Smarter Way to Manage Your Hostel';
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#E2E6EA] flex items-center justify-center p-3 sm:p-5 md:p-8 lg:p-10 xl:p-12 overflow-x-hidden antialiased font-sans selection:bg-[#E8503A] selection:text-white">
      {/* 
        The Centered White Outer Container with Generously Rounded Corners
        Faithfully replicating the Stylecraft Design reference framing
      */}
      <main className="w-full max-w-[1380px] bg-white rounded-[28px] sm:rounded-[36px] md:rounded-[44px] p-3 sm:p-4 md:p-5 lg:p-6 shadow-[0_25px_60px_-15px_rgba(15,23,42,0.12)] border border-white/80 transition-all duration-300">
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
