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
    <header className="relative z-20 w-full px-5 sm:px-8 md:px-12 pt-6 sm:pt-8 pb-4">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Official Hosteliq Logo (Rendered directly, no square container) */}
        <Link
          to="/"
          className="flex items-center gap-2.5 sm:gap-3 group select-none shrink-0"
          aria-label="Hosteliq Home"
        >
          <img
            src="/hosteliq-logo.png"
            alt="Hosteliq Platform"
            width={40}
            height={40}
            className="h-9 sm:h-10 w-auto max-w-[42px] object-contain transition-transform duration-200 group-hover:scale-105"
          />
          <span className="font-bold text-lg sm:text-xl text-white tracking-tight leading-none">
            Hosteliq
          </span>
        </Link>

        {/* Center: Desktop Navigation Links (Exactly 4 items on one line) */}
        <nav
          className="hidden md:flex items-center gap-8 lg:gap-10 select-none"
          aria-label="Main Navigation"
        >
          {navLinks.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-white/85 hover:text-white text-sm font-medium tracking-wide transition-colors duration-200 relative py-1 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[1.5px] after:bg-white after:transition-all hover:after:w-full"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Right: Actions (Desktop) */}
        <div className="hidden sm:flex items-center gap-3 md:gap-4 shrink-0 select-none">
          {/* Login with Separate Circular Arrow Icon Beside It */}
          <button
            onClick={handleLoginClick}
            type="button"
            className="group flex items-center gap-2 text-white hover:text-white/90 font-medium text-xs sm:text-sm transition-colors py-1.5 px-2 rounded-full focus:outline-none focus:ring-2 focus:ring-white/40"
            aria-label="Login to Hosteliq Portal"
          >
            <span className="font-medium">Login</span>
            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 group-hover:bg-white/20 border border-white/25 flex items-center justify-center text-white transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
              <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </span>
          </button>

          {/* Connect With Us: Rounded Pill-Shaped Button */}
          <button
            onClick={handleConnectClick}
            type="button"
            className="rounded-full bg-black/60 hover:bg-black/85 text-white border border-white/20 hover:border-white/40 px-5 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold backdrop-blur-md shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/50"
          >
            Connect With Us
          </button>
        </div>

        {/* Mobile Hamburger & Quick Login Button */}
        <div className="flex sm:hidden items-center gap-2">
          <button
            onClick={handleLoginClick}
            type="button"
            className="flex items-center gap-1.5 text-white bg-white/10 border border-white/20 px-3 py-1.5 rounded-full text-xs font-medium"
            aria-label="Login"
          >
            <span>Login</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            type="button"
            className="p-2 text-white hover:bg-white/15 rounded-xl transition-colors focus:outline-none"
            aria-label={isMobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
            aria-expanded={isMobileMenuOpen}
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
                alt="Hosteliq Platform"
                width={36}
                height={36}
                className="h-9 w-auto object-contain"
              />
              <span className="font-bold text-lg text-white">Hosteliq</span>
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
