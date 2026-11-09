import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StylecraftHero } from './StylecraftHero';
import defaultHeroLounge from '@/assets/hero-modern-lounge.jpg';

export interface StylecraftLandingPageProps {
  heroImageSrc?: string;
}

export function StylecraftLandingPage({ heroImageSrc }: StylecraftLandingPageProps) {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Hostel IQ — A Smarter Way to Manage Your Hostel';
  }, []);

  const activeImage = heroImageSrc || defaultHeroLounge || '/assets/hero-modern-lounge.jpg';

  const handleConnect = () => {
    navigate('/connect');
  };

  return (
    <div className="h-[100dvh] min-h-[100dvh] w-full bg-[#E2E6EA] flex flex-col items-center justify-start sm:justify-center p-1.5 sm:p-3 md:p-4 lg:p-5 box-border overflow-hidden antialiased font-sans selection:bg-[#E8503A] selection:text-white">
      {/* 
        The Centered White Outer Container with Generously Rounded Corners
        Fills the screen height from the top down (100dvh on mobile, proportional on desktop)
      */}
      <main className="w-full h-full max-w-[1680px] flex-1 flex flex-col bg-white rounded-[20px] xs:rounded-[24px] sm:rounded-[34px] md:rounded-[40px] p-1.5 sm:p-2.5 md:p-3 lg:p-3.5 shadow-[0_25px_60px_-15px_rgba(15,23,42,0.12)] border border-white/80 transition-all duration-300 overflow-hidden">
        <StylecraftHero
          imageSrc={activeImage}
          onConnect={handleConnect}
        />
      </main>
    </div>
  );
}
