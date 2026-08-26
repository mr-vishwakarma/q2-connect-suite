import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ChevronDown, ArrowRight, Shield, Sparkles, Building2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LightNavbarProps {
  onOpenAuth: () => void;
  onOpenLead: () => void;
}

export function LightNavbar({ onOpenAuth, onOpenLead }: LightNavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Platform', href: '#platform' },
    { label: 'Digital Twin', href: '#digital-twin' },
    { label: 'Fee Intelligence', href: '#fee-intelligence' },
    { label: 'Operations', href: '#operations' },
    { label: 'For Students', href: '#student-portal' },
    { label: 'AI Assistant', href: '#ai-assistant' },
    { label: 'Pricing', href: '#pricing' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-200 ${
        isScrolled
          ? 'bg-white/95 backdrop-blur-md shadow-[0_2px_12px_rgba(0,0,0,0.04)] border-b border-slate-200/80 py-3.5'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Brand Logo */}
        <a href="#" className="flex items-center gap-3 group select-none">
          <div className="w-10 h-10 rounded-xl bg-white shadow-sm border border-slate-200/80 p-1 flex items-center justify-center shrink-0 group-hover:border-purple-300 transition-colors">
            <img src="/q2-logo.png" alt="Q2 Group of Hostels" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col text-left">
            <span className="font-extrabold text-slate-900 text-lg tracking-tight leading-none group-hover:text-purple-600 transition-colors">
              Q2 <span className="font-medium text-slate-500 text-sm">Hostels</span>
            </span>
            <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase mt-0.5">
              SaaS Operating System
            </span>
          </div>
        </a>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 bg-white/70 border border-slate-200/60 rounded-full px-4 py-1.5 shadow-sm backdrop-blur-sm">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-purple-700 hover:bg-purple-50/80 rounded-full transition-all duration-150"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Action Buttons */}
        <div className="hidden sm:flex items-center gap-3">
          <button
            onClick={onOpenAuth}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-purple-700 hover:bg-slate-100 rounded-xl transition-all"
          >
            Login
          </button>
          <Button
            onClick={onOpenLead}
            className="bg-slate-900 hover:bg-purple-600 text-white font-medium text-xs px-4 py-2 h-9 rounded-xl shadow-sm transition-all duration-150"
          >
            <span>Get Started</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </div>

        {/* Mobile Hamburger */}
        <div className="flex items-center gap-2 lg:hidden">
          <button
            onClick={onOpenAuth}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
          >
            Login
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-white border-b border-slate-200 px-4 pt-3 pb-6 space-y-3 shadow-xl"
          >
            <div className="flex flex-col space-y-1">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-xl transition-colors text-left"
                >
                  {link.label}
                </a>
              ))}
            </div>
            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
              <Button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenLead();
                }}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm rounded-xl py-2.5"
              >
                Book Guided Pilot
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
