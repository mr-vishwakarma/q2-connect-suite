import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

export interface StylecraftNavbarProps {
  onConnect?: () => void;
}

export function StylecraftNavbar({ onConnect }: StylecraftNavbarProps) {
  const navigate = useNavigate();

  const handleLoginClick = () => {
    navigate('/login');
  };

  const navLinks = [
    { label: 'Platform', href: '#platform' },
    { label: 'Solutions', href: '#solutions' },
    { label: 'Features', href: '#features' },
    { label: 'About', href: '#about' },
  ];

  return (
    <header className="relative w-full z-30 select-none">
      {/* 
        ========================================================================
        MAIN NAVBAR: 3-PART CSS GRID LAYOUT
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr)
        - Left: Hostel IQ Logo Pocket (justify-self-start)
          * Mobile: Enlarged logo icon visible clearly, compact pocket
          * Desktop: Enlarged logo icon + "Hostel IQ" brand text
        - Center: Rounded Capsule Navigation (justify-self-center)
          * Generous, distinct spacing between nav tabs
          * 4-column equal CSS Grid with column gaps
        - Right: Actions Pocket (justify-self-end)
          * Mobile: Just the circular login arrow button (↗)
          * Desktop: Login text + "Connect with us" pill + circular arrow button
        Guarantees exact mathematical centering on both mobile and desktop!
        ========================================================================
      */}
      <div className="w-full grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center">
        {/* 
          1. TOP-LEFT WHITE POCKET (LOGO)
          Mobile: Enlarged logo icon centered in pocket
          Desktop: Logo + "Hostel IQ" brand text
        */}
        <div className="justify-self-start relative bg-white h-[54px] xs:h-[60px] sm:h-[68px] md:h-[76px] w-[58px] xs:w-[66px] sm:w-[230px] md:w-[290px] lg:w-[340px] shrink-0 px-2 xs:px-3 sm:pl-6 md:pl-7 sm:pr-4 rounded-br-[20px] xs:rounded-br-[24px] sm:rounded-br-[30px] md:rounded-br-[34px] flex items-center justify-center sm:justify-start z-20">
          <Link
            to="/"
            className="flex items-center gap-2.5 sm:gap-3 group"
            aria-label="Hostel IQ Home"
          >
            {/* Enlarged official logo */}
            <img
              src="/hosteliq-logo.png"
              alt="Hostel IQ Platform"
              width={44}
              height={44}
              className="h-8 xs:h-9 sm:h-10 md:h-11 w-auto max-w-[42px] xs:max-w-[48px] sm:max-w-[52px] object-contain transition-transform duration-200 group-hover:scale-105"
            />
            {/* Desktop Brand Text — Hidden on mobile as per requirement */}
            <span className="hidden sm:inline font-extrabold text-base sm:text-lg md:text-xl text-slate-950 tracking-tight leading-none whitespace-nowrap">
              Hostel IQ
            </span>
          </Link>

          {/* Top-Right Pure CSS Inverted Fillet (Seamless curve into top border) */}
          <div
            className="absolute top-0 left-[calc(100%-1px)] w-[20px] xs:w-[24px] sm:w-[26px] md:w-[28px] h-[20px] xs:h-[24px] sm:h-[26px] md:h-[28px] overflow-hidden pointer-events-none"
            aria-hidden="true"
          >
            <div
              className="absolute top-0 left-0 w-[40px] xs:w-[48px] sm:w-[52px] md:w-[56px] h-[40px] xs:h-[48px] sm:h-[52px] md:h-[56px] rounded-full"
              style={{ boxShadow: '0 0 0 50px #ffffff' }}
            />
          </div>

          {/* Bottom-Left Pure CSS Inverted Fillet (Seamless curve into left border) */}
          <div
            className="absolute top-[calc(100%-1px)] left-0 w-[20px] xs:w-[24px] sm:w-[26px] md:w-[28px] h-[20px] xs:h-[24px] sm:h-[26px] md:h-[28px] overflow-hidden pointer-events-none"
            aria-hidden="true"
          >
            <div
              className="absolute top-0 left-0 w-[40px] xs:w-[48px] sm:w-[52px] md:w-[56px] h-[40px] xs:h-[48px] sm:h-[52px] md:h-[56px] rounded-full"
              style={{ boxShadow: '0 0 0 50px #ffffff' }}
            />
          </div>
        </div>

        {/* 
          2. CENTER NAVIGATION CAPSULE (VISIBLE ON BOTH MOBILE AND DESKTOP)
          - Distinct, comfortable spacing between tabs (increased horizontal padding and gaps)
          - Dark translucent background with border & blur: bg-black/50 backdrop-blur-md
          - 4-column equal CSS Grid: repeat(4, minmax(0, 1fr))
        */}
        <div className="justify-self-center flex items-center px-1 xs:px-2">
          <nav
            className="grid grid-cols-4 items-center gap-1 xs:gap-1.5 sm:gap-3 md:gap-4 bg-black/50 backdrop-blur-md border border-white/10 rounded-full px-3 xs:px-4 sm:px-6 lg:px-8 py-1.5 xs:py-2 sm:py-2.5 shadow-[0_4px_24px_rgba(0,0,0,0.3)]"
            style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}
            aria-label="Main Navigation"
          >
            {navLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-white/85 hover:text-white text-[11px] xs:text-[12px] sm:text-xs lg:text-sm font-semibold tracking-normal sm:tracking-wide transition-colors duration-200 py-0.5 sm:py-1 px-1.5 xs:px-2 sm:px-3.5 lg:px-4 text-center whitespace-nowrap hover:drop-shadow-[0_2px_8px_rgba(255,255,255,0.35)]"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        {/* 
          3. TOP-RIGHT WHITE POCKET (LOGIN / ACTIONS)
          Mobile: Only the login arrow icon button is visible
          Desktop: Login text + "Connect with us" pill + circular arrow button
        */}
        <div className="justify-self-end relative bg-white h-[54px] xs:h-[60px] sm:h-[68px] md:h-[76px] w-[58px] xs:w-[66px] sm:w-[230px] md:w-[290px] lg:w-[340px] shrink-0 px-2 xs:px-2.5 sm:pl-4 sm:pr-6 md:pr-7 rounded-bl-[20px] xs:rounded-bl-[24px] sm:rounded-bl-[30px] md:rounded-bl-[34px] flex items-center justify-center sm:justify-end gap-2 sm:gap-3 z-20">
          {/* Top-Left Pure CSS Inverted Fillet (Seamless curve into top border) */}
          <div
            className="absolute top-0 right-[calc(100%-1px)] w-[20px] xs:w-[24px] sm:w-[26px] md:w-[28px] h-[20px] xs:h-[24px] sm:h-[26px] md:h-[28px] overflow-hidden pointer-events-none"
            aria-hidden="true"
          >
            <div
              className="absolute top-0 right-0 w-[40px] xs:w-[48px] sm:w-[52px] md:w-[56px] h-[40px] xs:h-[48px] sm:h-[52px] md:h-[56px] rounded-full"
              style={{ boxShadow: '0 0 0 50px #ffffff' }}
            />
          </div>

          {/* Bottom-Right Pure CSS Inverted Fillet (Seamless curve into right border) */}
          <div
            className="absolute top-[calc(100%-1px)] right-0 w-[20px] xs:w-[24px] sm:w-[26px] md:w-[28px] h-[20px] xs:h-[24px] sm:h-[26px] md:h-[28px] overflow-hidden pointer-events-none"
            aria-hidden="true"
          >
            <div
              className="absolute top-0 right-0 w-[40px] xs:w-[48px] sm:w-[52px] md:w-[56px] h-[40px] xs:h-[48px] sm:h-[52px] md:h-[56px] rounded-full"
              style={{ boxShadow: '0 0 0 50px #ffffff' }}
            />
          </div>

          {/* Desktop Only: Login text with diagonal arrow */}
          <button
            onClick={handleLoginClick}
            type="button"
            className="hidden xl:flex items-center gap-1.5 text-slate-800 hover:text-black font-semibold text-xs sm:text-sm px-2.5 py-1.5 rounded-full hover:bg-slate-100 transition-colors whitespace-nowrap"
            aria-label="Login"
          >
            <span>Login</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
          </button>

          {/* Desktop Only: Connect with us Pill Button (Slate-950 pill with white text) */}
          <button
            onClick={onConnect}
            type="button"
            className="hidden sm:inline-flex rounded-full bg-slate-950 hover:bg-black text-white px-3.5 sm:px-4 md:px-5 py-2 text-xs sm:text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 whitespace-nowrap"
            aria-label="Connect With Us"
          >
            Connect with us
          </button>

          {/* Circular Arrow Button — Always visible (on mobile it is the ONLY action visible on the top right) */}
          <button
            onClick={handleLoginClick}
            type="button"
            className="flex w-8 h-8 xs:w-9 xs:h-9 sm:w-10 sm:h-10 rounded-full bg-slate-950 hover:bg-black text-white items-center justify-center shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 shrink-0"
            title="Login to Portal"
            aria-label="Login to Portal"
          >
            <ArrowUpRight className="w-3.5 h-3.5 xs:w-4 xs:h-4 sm:w-4.5 sm:h-4.5 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </header>
  );
}
