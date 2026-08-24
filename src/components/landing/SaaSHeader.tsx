import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Menu, X, ArrowRight } from 'lucide-react';

const NAV_LINKS = [
  { name: 'Home', href: '/#hero' },
  { name: 'Platform', href: '/#experiences' },
  { name: 'Hostel Matrix', href: '/#operations' },
  { name: 'Features', href: '/#features' },
  { name: 'Security', href: '/#security' },
  { name: 'About Us', href: '/#about' },
];

export function SaaSHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (href: string) => {
    setIsMobileOpen(false);
    if (href.startsWith('/#')) {
      const targetId = href.replace('/#', '');
      if (location.pathname === '/') {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  };

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-background/85 backdrop-blur-xl border-b border-border/60 shadow-lg shadow-black/20'
          : 'bg-transparent'
      }`}
    >
      <div className="container mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <motion.div
            whileHover={{ scale: 1.05, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary via-primary/80 to-purple-800 p-0.5 flex items-center justify-center shadow-lg shadow-primary/25"
          >
            <div className="w-full h-full bg-background rounded-[10px] flex items-center justify-center p-1.5 overflow-hidden">
              <img src="/q2-logo.png" alt="Q2 Logo" className="w-full h-full object-contain" />
            </div>
          </motion.div>
          <div className="flex flex-col">
            <span className="text-lg font-black tracking-tight text-foreground flex items-center gap-1.5">
              Q2 <span className="text-primary font-extrabold text-sm tracking-widest uppercase">Hostels</span>
            </span>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider -mt-1">
              SaaS Operating Suite
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1 bg-secondary/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-border/50">
          {NAV_LINKS.map((link) => (
            <a
              key={link.name}
              href={link.href}
              onClick={() => handleNavClick(link.href)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
            >
              {link.name}
            </a>
          ))}
        </nav>

        {/* Right CTA Actions */}
        <div className="hidden sm:flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="text-xs font-bold hover:text-primary">
            <Link to="/login">Sign In</Link>
          </Button>
          <Button size="sm" asChild className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-md shadow-primary/25 rounded-full px-4">
            <Link to="/login" className="flex items-center gap-1.5">
              <span>Get Started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        </div>

        {/* Mobile Hamburger */}
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="md:hidden p-2 text-muted-foreground hover:text-foreground"
          aria-label="Toggle Menu"
        >
          {isMobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-card/95 backdrop-blur-2xl border-b border-border px-6 py-5 space-y-4"
          >
            <div className="flex flex-col gap-2">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={() => handleNavClick(link.href)}
                  className="text-sm font-semibold text-foreground hover:text-primary py-2 px-3 rounded-lg hover:bg-secondary/60"
                >
                  {link.name}
                </a>
              ))}
            </div>
            <div className="pt-3 border-t border-border/50 flex flex-col gap-2">
              <Button variant="outline" asChild className="w-full justify-center">
                <Link to="/login" onClick={() => setIsMobileOpen(false)}>Sign In</Link>
              </Button>
              <Button asChild className="w-full justify-center bg-primary text-primary-foreground">
                <Link to="/login" onClick={() => setIsMobileOpen(false)}>Get Started</Link>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
