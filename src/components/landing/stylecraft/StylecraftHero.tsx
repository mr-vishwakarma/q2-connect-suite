import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { HeroBackground } from './HeroBackground';
import { StylecraftNavbar } from './StylecraftNavbar';

export interface StylecraftHeroProps {
  imageSrc?: string;
  onConnect?: () => void;
}

export function StylecraftHero({ imageSrc, onConnect }: StylecraftHeroProps) {
  return (
    <section
      className="relative w-full h-full flex-1 rounded-[20px] sm:rounded-[28px] md:rounded-[36px] overflow-hidden flex flex-col justify-between min-h-[500px] sm:min-h-[580px] md:min-h-[640px] shadow-[inset_0_0_80px_rgba(0,0,0,0.45)]"
      aria-label="Hostel IQ Platform Introduction"
    >
      {/* 1. Configurable Hero Background Image & Atmospheric Lighting */}
      <HeroBackground imageSrc={imageSrc} />

      {/* 2. Top Dual-Pocket Curved Notch Navigation Bar */}
      <StylecraftNavbar onConnect={onConnect} />

      {/* 3. Centered Editorial Headline, Supporting Text & Compact Rounded CTA */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-5 sm:px-8 md:px-12 py-8 sm:py-12 md:py-16 max-w-4xl mx-auto my-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-3.5 sm:space-y-4 md:space-y-5"
        >
          {/* Main Headline */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-[64px] font-bold text-white tracking-tight leading-[1.12] drop-shadow-md font-sans">
            A Smarter Way to Manage <br className="hidden sm:inline" />
            Your Hostel
          </h1>

          {/* Supporting Description */}
          <p className="text-xs sm:text-base md:text-lg text-white/85 font-normal max-w-2xl mx-auto leading-relaxed drop-shadow px-2">
            One platform for managing hostel operations, students, rooms and payments.
          </p>
        </motion.div>

        {/* Compact Signature Rounded CTA Pill (Exact style of the reference screenshot) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 sm:mt-8 md:mt-10"
        >
          <button
            onClick={onConnect}
            type="button"
            className="group inline-flex items-center gap-3.5 pl-6 pr-2.5 py-2 sm:py-2.5 bg-[#E8503A] hover:bg-[#D43F2A] text-white rounded-full font-semibold text-xs sm:text-sm tracking-wide shadow-xl shadow-[#E8503A]/30 hover:shadow-2xl hover:shadow-[#E8503A]/40 hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#E8503A]/60"
            aria-label="Connect With Us"
          >
            <span>Connect With Us</span>
            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white text-[#E8503A] flex items-center justify-center transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shadow-sm">
              <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
            </span>
          </button>
        </motion.div>
      </div>

      {/* Bottom spacer for aesthetic vertical equilibrium (matching the navbar height) */}
      <div className="h-[40px] sm:h-[60px] pointer-events-none" />
    </section>
  );
}
