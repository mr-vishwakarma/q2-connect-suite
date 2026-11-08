import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Menu, X } from 'lucide-react';

export interface StylecraftNavbarProps {
  onConnect?: () => void;
}

export function StylecraftNavbar({ onConnect }: StylecraftNavbarProps) {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMenuOpen]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const handleLoginClick = () => {
    setIsMobileMenuOpen(false);
    navigate('/login');
  };

  const handleConnectClick = () => {
    setIsMobileMenuOpen(false);
    onConnect?.();
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
        - Center: Rounded Capsule Navigation (justify-self-center)
        - Right: Actions Pocket (justify-self-end)
        Guarantees exact mathematical centering of the navigation capsule!
        ========================================================================
      */}
      <div className="w-full grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center">
        {/* 
          1. TOP-LEFT WHITE POCKET (HOSTEL IQ LOGO)
          Seamlessly connected to the white frame with pure CSS box-shadow inverted fillets (no SVG, zero seams).
        */}
        <div className="justify-self-start relative bg-white h-[58px] sm:h-[66px] md:h-[74px] w-[210px] sm:w-[260px] md:w-[290px] lg:w-[330px] shrink-0 pl-4 sm:pl-6 md:pl-7 pr-4 rounded-br-[24px] sm:rounded-br-[30px] flex items-center z-20">
          <Link
            to="/"
            className="flex items-center gap-2.5 sm:gap-3 group"
            aria-label="Hostel IQ Home"
          >
            <img
              src="/hosteliq-logo.png"
              alt="Hostel IQ Platform"
              width={38}
              height={38}
              className="h-7 sm:h-8 md:h-9 w-auto max-w-[40px] object-contain transition-transform duration-200 group-hover:scale-105"
            />
            <span className="font-extrabold text-base sm:text-lg md:text-xl text-slate-950 tracking-tight leading-none">
              Hostel IQ
            </span>
          </Link>

          {/* Top-Right Pure CSS Inverted Fillet (Seamless curve into top border, 1px overlap prevents hairline cracks) */}
          <div
            className="absolute top-0 left-[calc(100%-1px)] w-[26px] sm:w-[28px] h-[26px] sm:h-[28px] overflow-hidden pointer-events-none"
            aria-hidden="true"
          >
            <div
              className="absolute top-0 left-0 w-[52px] sm:w-[56px] h-[52px] sm:h-[56px] rounded-full"
              style={{ boxShadow: '0 0 0 50px #ffffff' }}
            />
          </div>

          {/* Bottom-Left Pure CSS Inverted Fillet (Seamless curve into left border, 1px overlap prevents hairline cracks) */}
          <div
            className="absolute top-[calc(100%-1px)] left-0 w-[26px] sm:w-[28px] h-[26px] sm:h-[28px] overflow-hidden pointer-events-none"
            aria-hidden="true"
          >
            <div
              className="absolute top-0 left-0 w-[52px] sm:w-[56px] h-[52px] sm:h-[56px] rounded-full"
              style={{ boxShadow: '0 0 0 50px #ffffff' }}
            />
          </div>
        </div>

        {/* 
          2. CENTER NAVIGATION CAPSULE (MATHEMATICALLY CENTERED)
          - Rounded pill-shaped container with dark translucent background
          - 4-column CSS Grid: grid-template-columns: repeat(4, minmax(0, 1fr))
          - Each item occupies an equal-width column with centered text
          - Distance(Left Edge -> Platform) === Distance(About -> Right Edge)
        */}
        <div className="justify-self-center hidden md:flex items-center px-2">
          <nav
            className="grid grid-cols-4 items-center bg-black/45 backdrop-blur-md border border-white/10 rounded-full px-5 lg:px-7 py-2 shadow-[0_4px_24px_rgba(0,0,0,0.25)]"
            style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}
            aria-label="Main Navigation"
          >
            {navLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-white/80 hover:text-white text-xs lg:text-sm font-medium tracking-wide transition-colors duration-200 py-1 px-3 lg:px-4 text-center whitespace-nowrap hover:drop-shadow-[0_2px_8px_rgba(255,255,255,0.3)]"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        {/* 
          3. TOP-RIGHT WHITE POCKET (ACTIONS)
          Seamlessly connected to the white frame with pure CSS box-shadow inverted fillets (no SVG, zero seams).
        */}
        <div className="justify-self-end relative bg-white h-[58px] sm:h-[66px] md:h-[74px] w-[210px] sm:w-[260px] md:w-[290px] lg:w-[330px] shrink-0 pr-4 sm:pl-4 sm:pr-6 md:pr-7 rounded-bl-[24px] sm:rounded-bl-[30px] flex items-center justify-end gap-2 sm:gap-3 z-20">
          {/* Top-Left Pure CSS Inverted Fillet (Seamless curve into top border, 1px overlap prevents hairline cracks) */}
          <div
            className="absolute top-0 right-[calc(100%-1px)] w-[26px] sm:w-[28px] h-[26px] sm:h-[28px] overflow-hidden pointer-events-none"
            aria-hidden="true"
          >
            <div
              className="absolute top-0 right-0 w-[52px] sm:w-[56px] h-[52px] sm:h-[56px] rounded-full"
              style={{ boxShadow: '0 0 0 50px #ffffff' }}
            />
          </div>

          {/* Bottom-Right Pure CSS Inverted Fillet (Seamless curve into right border, 1px overlap prevents hairline cracks) */}
          <div
            className="absolute top-[calc(100%-1px)] right-0 w-[26px] sm:w-[28px] h-[26px] sm:h-[28px] overflow-hidden pointer-events-none"
            aria-hidden="true"
          >
            <div
              className="absolute top-0 right-0 w-[52px] sm:w-[56px] h-[52px] sm:h-[56px] rounded-full"
              style={{ boxShadow: '0 0 0 50px #ffffff' }}
            />
          </div>

          {/* Desktop Action 1: Login text with diagonal arrow */}
          <button
            onClick={handleLoginClick}
            type="button"
            className="hidden xl:flex items-center gap-1.5 text-slate-800 hover:text-black font-semibold text-xs sm:text-sm px-2.5 py-1.5 rounded-full hover:bg-slate-100 transition-colors whitespace-nowrap"
            aria-label="Login"
          >
            <span>Login</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
          </button>

          {/* Desktop Action 2: Connect with us Pill Button (Slate-950 pill with white text) */}
          <button
            onClick={handleConnectClick}
            type="button"
            className="hidden sm:inline-flex rounded-full bg-slate-950 hover:bg-black text-white px-3.5 sm:px-4 md:px-5 py-2 text-xs sm:text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 whitespace-nowrap"
            aria-label="Connect With Us"
          >
            Connect with us
          </button>

          {/* Desktop Action 3: Separate Circular Arrow Button */}
          <button
            onClick={handleLoginClick}
            type="button"
            className="hidden sm:flex w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full bg-slate-950 hover:bg-black text-white items-center justify-center shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 shrink-0"
            title="Login to Portal"
            aria-label="Login to Portal"
          >
            <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
          </button>

          {/* Mobile Quick Action Pill */}
          <button
            onClick={handleConnectClick}
            type="button"
            className="sm:hidden rounded-full bg-slate-950 text-white px-3 py-1.5 text-xs font-semibold"
          >
            Connect
          </button>

          {/* Mobile Hamburger Drawer Trigger */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            type="button"
            className="md:hidden p-1.5 text-slate-900 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none"
            aria-label={isMobileMenuOpen ? 'Close Menu' : 'Open Menu'}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col bg-slate-950/95 backdrop-blur-xl animate-in fade-in duration-200 p-6">
          <div className="flex items-center justify-between pb-6 border-b border-white/10">
            <Link
              to="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-2.5"
            >
              <img
                src="/hosteliq-logo.png"
                alt="Hostel IQ"
                width={36}
                height={36}
                className="h-9 w-auto object-contain"
              />
              <span className="font-bold text-lg text-white">Hostel IQ</span>
            </Link>

            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 text-white/80 hover:text-white rounded-lg bg-white/10"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex flex-col gap-4 py-8 flex-1">
            {navLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-white/90 hover:text-white text-lg font-medium py-2 border-b border-white/5 transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex flex-col gap-3 pt-6 border-t border-white/10">
            <button
              onClick={handleConnectClick}
              className="w-full py-3 rounded-full bg-[#E8503A] hover:bg-[#D6432E] text-white font-semibold text-sm transition-all text-center shadow-lg"
            >
              Connect With Us
            </button>

            <button
              onClick={handleLoginClick}
              className="w-full py-3 rounded-full bg-white/10 hover:bg-white/20 text-white font-medium text-sm transition-all flex items-center justify-center gap-2 border border-white/15"
            >
              <span>Login to Portal</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}