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
        1. TOP-LEFT WHITE POCKET: HOSTEL IQ LOGO
        Directly matches the Stylecraft Design reference:
        - White pocket background holding the logo
        - Rounded bottom-right corner (rounded-br)
        - Inverted concave fillets on top-right and bottom-left
        ========================================================================
      */}
      <div className="absolute top-0 left-0 bg-white h-[58px] sm:h-[68px] md:h-[76px] pl-5 sm:pl-7 md:pl-9 pr-6 sm:pr-8 md:pr-10 rounded-br-[22px] sm:rounded-br-[28px] md:rounded-br-[32px] flex items-center z-20 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
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
            className="h-8 sm:h-9 md:h-10 w-auto max-w-[42px] object-contain transition-transform duration-200 group-hover:scale-105"
          />
          <span className="font-extrabold text-base sm:text-lg md:text-xl text-slate-950 tracking-tight leading-none">
            Hostel IQ
          </span>
        </Link>

        {/* Top-Right Inverted Concave Fillet (Transitions from pocket to top dark edge) */}
        <svg
          className="absolute top-0 -right-[22px] sm:-right-[28px] md:-right-[32px] w-[22px] sm:w-[28px] md:w-[32px] h-[22px] sm:h-[28px] md:h-[32px] text-white fill-current pointer-events-none"
          viewBox="0 0 28 28"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M 0 0 L 0 28 A 28 28 0 0 0 28 0 Z" />
        </svg>

        {/* Bottom-Left Inverted Concave Fillet (Transitions from pocket to left dark edge) */}
        <svg
          className="absolute left-0 -bottom-[22px] sm:-bottom-[28px] md:-bottom-[32px] w-[22px] sm:w-[28px] md:w-[32px] h-[22px] sm:h-[28px] md:h-[32px] text-white fill-current pointer-events-none"
          viewBox="0 0 28 28"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M 0 0 L 28 0 A 28 28 0 0 0 0 28 Z" />
        </svg>
      </div>

      {/* 
        ========================================================================
        2. TOP-RIGHT WHITE POCKET: BUTTONS
        Directly matches the Stylecraft Design reference:
        - White pocket background holding Connect With Us & (↗) Arrow Button
        - Rounded bottom-left corner (rounded-bl)
        - Inverted concave fillets on top-left and bottom-right
        ========================================================================
      */}
      <div className="absolute top-0 right-0 bg-white h-[58px] sm:h-[68px] md:h-[76px] pl-6 sm:pl-8 md:pl-10 pr-5 sm:pr-7 md:pr-9 rounded-bl-[22px] sm:rounded-bl-[28px] md:rounded-bl-[32px] flex items-center gap-2.5 sm:gap-3.5 z-20 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
        {/* Top-Left Inverted Concave Fillet (Transitions from pocket to top dark edge) */}
        <svg
          className="absolute top-0 -left-[22px] sm:-left-[28px] md:-left-[32px] w-[22px] sm:w-[28px] md:w-[32px] h-[22px] sm:h-[28px] md:h-[32px] text-white fill-current pointer-events-none"
          viewBox="0 0 28 28"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M 28 0 L 28 28 A 28 28 0 0 1 0 0 Z" />
        </svg>

        {/* Bottom-Right Inverted Concave Fillet (Transitions from pocket to right dark edge) */}
        <svg
          className="absolute right-0 -bottom-[22px] sm:-bottom-[28px] md:-bottom-[32px] w-[22px] sm:w-[28px] md:w-[32px] h-[22px] sm:h-[28px] md:h-[32px] text-white fill-current pointer-events-none"
          viewBox="0 0 28 28"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M 28 0 L 0 0 A 28 28 0 0 1 28 28 Z" />
        </svg>

        {/* Desktop Action 1: Login */}
        <button
          onClick={handleLoginClick}
          type="button"
          className="hidden lg:flex items-center gap-1.5 text-slate-800 hover:text-black font-semibold text-xs sm:text-sm px-3 py-1.5 rounded-full hover:bg-slate-100 transition-colors"
          aria-label="Login"
        >
          <span>Login</span>
          <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
        </button>

        {/* Desktop Action 2: Connect With Us Pill Button (Exact Stylecraft reference) */}
        <button
          onClick={handleConnectClick}
          type="button"
          className="hidden sm:inline-flex rounded-full bg-slate-950 hover:bg-black text-white px-5 sm:px-6 py-2.5 text-xs sm:text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200 active:scale-95"
          aria-label="Connect With Us"
        >
          Connect with us
        </button>

        {/* Desktop Action 3: Separate Circular Arrow Button (Exact Stylecraft reference) */}
        <button
          onClick={handleLoginClick}
          type="button"
          className="hidden sm:flex w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-950 hover:bg-black text-white items-center justify-center shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
          title="Login to Portal"
          aria-label="Login to Portal"
        >
          <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
        </button>

        {/* Mobile Quick Action Pill */}
        <button
          onClick={handleConnectClick}
          type="button"
          className="sm:hidden rounded-full bg-slate-950 text-white px-3.5 py-1.5 text-xs font-semibold"
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

      {/* 
        ========================================================================
        3. CENTER NAVIGATION BAR (FLOATING OVER THE DARK HERO BACKGROUND)
        Exactly aligned in height with the two white pockets:
        - 4 items: Platform, Solutions, Features, About
        - White text directly on the dark background
        ========================================================================
      */}
      <div className="w-full h-[58px] sm:h-[68px] md:h-[76px] flex items-center justify-center pointer-events-none px-4">
        <nav
          className="hidden md:flex items-center gap-7 lg:gap-11 pointer-events-auto"
          aria-label="Main Navigation"
        >
          {navLinks.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-white/85 hover:text-white text-sm font-medium tracking-wide transition-colors duration-200 relative py-1 hover:drop-shadow-[0_2px_8px_rgba(255,255,255,0.3)]"
            >
              {item.label}
            </a>
          ))}
        </nav>
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
