import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, PhoneCall, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FinalCTAProps {
  onOpenLead: () => void;
}

export function FinalCTA({ onOpenLead }: FinalCTAProps) {
  return (
    <section className="py-20 sm:py-28 bg-white relative overflow-hidden text-left">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 text-white p-8 sm:p-14 lg:p-20 overflow-hidden shadow-2xl border border-purple-900/40">
          {/* Subtle background ambient light */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-purple-600/30 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 border border-white/20 text-purple-200 text-xs font-semibold mb-6 backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5 text-purple-300" />
              <span>Modernize Your Property Today</span>
            </div>

            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1]">
              Your hostel deserves better tools.
            </h2>

            <p className="text-base sm:text-lg text-slate-300 mt-6 leading-relaxed max-w-2xl font-normal">
              Give your team one place to manage the hostel — and give your residents a better experience. Start your 14-day free pilot with assisted data migration.
            </p>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mt-8">
              <Button
                onClick={onOpenLead}
                size="lg"
                className="h-12 px-8 rounded-2xl bg-purple-500 hover:bg-purple-600 text-white font-bold text-sm shadow-lg shadow-purple-600/30 transition-all"
              >
                <span>Get Started Now</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              <Button
                onClick={onOpenLead}
                variant="outline"
                size="lg"
                className="h-12 px-7 rounded-2xl bg-white/10 hover:bg-white/20 text-white border-white/20 font-semibold text-sm backdrop-blur-sm transition-all"
              >
                <PhoneCall className="w-4 h-4 mr-2" />
                <span>Talk to Q2 Hospitality Tech</span>
              </Button>
            </div>

            {/* Guarantee badges */}
            <div className="flex flex-wrap items-center gap-6 mt-10 text-xs text-slate-400 font-medium">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>14-Day Free Pilot</span>
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Free Data Migration from Excel</span>
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Cancel Anytime</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
