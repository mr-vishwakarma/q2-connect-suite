import { motion } from 'framer-motion';
import { ArrowRight, Play, CheckCircle2, ShieldCheck, Sparkles, Building2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HeroProductScene } from './HeroProductScene';

interface LightHeroProps {
  onOpenLead: () => void;
  onOpenAuth: () => void;
}

export function LightHero({ onOpenLead, onOpenAuth }: LightHeroProps) {
  return (
    <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden bg-gradient-to-b from-[#FAFBFD] via-[#F8F9FC] to-white">
      {/* Background Soft Glows (Subtle, non-distracting) */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-tr from-purple-100/40 via-teal-50/40 to-indigo-100/40 blur-3xl -z-10 rounded-full pointer-events-none" />
      <div className="absolute top-48 left-10 w-72 h-72 bg-purple-200/20 blur-3xl -z-10 rounded-full pointer-events-none" />
      <div className="absolute top-64 right-10 w-72 h-72 bg-teal-200/20 blur-3xl -z-10 rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Category Pill Tag */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm text-xs font-semibold text-slate-700 mb-6"
        >
          <span className="flex h-2 w-2 rounded-full bg-purple-600 animate-pulse" />
          <span className="text-slate-500 font-medium">Q2 GROUP OF HOSTELS</span>
          <span className="text-slate-300">•</span>
          <span className="text-purple-700">Next-Gen SaaS Platform</span>
        </motion.div>

        {/* Hero Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-4xl sm:text-6xl lg:text-7xl font-black text-slate-900 tracking-tight leading-[1.08] max-w-4xl mx-auto"
        >
          Run your hostel.{' '}
          <span className="bg-gradient-to-r from-purple-600 via-indigo-600 to-teal-600 bg-clip-text text-transparent">
            Smarter.
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-base sm:text-lg lg:text-xl text-slate-600 max-w-2xl mx-auto mt-6 leading-relaxed font-normal"
        >
          Q2 brings students, rooms, payments, staff, maintenance, and everyday hostel operations into one intelligent platform.
        </motion.p>

        {/* Action CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mt-8 sm:mt-10"
        >
          <Button
            onClick={onOpenLead}
            size="lg"
            className="w-full sm:w-auto h-12 px-8 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold text-sm shadow-xl shadow-purple-600/20 hover:-translate-y-0.5 transition-all duration-150"
          >
            <span>Get Started</span>
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>

          <a
            href="#platform"
            className="w-full sm:w-auto h-12 px-7 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm border border-slate-200/80 shadow-sm flex items-center justify-center hover:-translate-y-0.5 transition-all duration-150"
          >
            <span>Explore the Platform</span>
          </a>
        </motion.div>

        {/* Trust Badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex flex-wrap items-center justify-center gap-6 mt-8 text-xs text-slate-500 font-medium"
        >
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Zero Spreadsheet Dependency</span>
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Automated WhatsApp Fee Reminders</span>
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Multi-Branch Tenant Isolation</span>
          </span>
        </motion.div>

        {/* Hero Interactive Product Scene Centerpiece */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="mt-14 sm:mt-16"
        >
          <HeroProductScene />
        </motion.div>
      </div>
    </section>
  );
}
