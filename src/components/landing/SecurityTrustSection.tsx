import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Lock,
  Database,
  Eye,
  KeyRound,
  FileCheck2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

const SECURITY_CARDS = [
  {
    icon: Database,
    title: 'Strict Tenant Isolation',
    desc: 'Each organization and branch operates within an isolated cryptographic data boundary, preventing cross-tenant leakage.',
  },
  {
    icon: KeyRound,
    title: 'Granular Role-Based Access',
    desc: 'Assign exact permissions for Owners, Managers, Wardens, and Accountants. Prevent unauthorized financial updates.',
  },
  {
    icon: FileCheck2,
    title: 'Immutable Compliance Audit',
    desc: 'Every fee collection, room transfer, and policy change is recorded with timestamps, actor IDs, and IP addresses.',
  },
  {
    icon: Lock,
    title: 'Enterprise Encryption',
    desc: 'JWT token rotation, hashed credentials, and secure HTTPS transport ensuring student privacy and data integrity.',
  },
];

export function SecurityTrustSection() {
  return (
    <section id="security" className="py-24 relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
          <Badge variant="outline" className="text-xs font-semibold px-3 py-1 border-primary/30 text-primary">
            Enterprise Grade Security
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-black text-foreground tracking-tight">
            Your Data. Your Hostel. Your Control.
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg">
            Engineered with bank-grade security protocols to protect student records, payment history, and operational secrets.
          </p>
        </div>

        {/* Security Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto mb-16">
          {SECURITY_CARDS.map((card) => (
            <motion.div
              key={card.title}
              whileHover={{ y: -4 }}
              className="bg-card border border-border/70 rounded-2xl p-5 space-y-3 shadow-sm hover:border-primary/40 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <card.icon className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-foreground">{card.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{card.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Final CTA Banner */}
        <div className="max-w-5xl mx-auto bg-gradient-to-br from-primary/20 via-purple-900/20 to-card border border-primary/40 rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden shadow-2xl">
          <div className="max-w-2xl mx-auto space-y-5">
            <h3 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
              Ready to Simplify Your Hostel Management?
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground">
              Join leading hostels and PG chains running on the Q2 Connect Suite. Onboard your property in minutes.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button size="lg" asChild className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-full px-8 shadow-lg shadow-primary/30">
                <Link to="/login" className="flex items-center gap-2">
                  <span>Get Started Now</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="rounded-full px-8 font-semibold border-border/80">
                <Link to="/contact">Contact Sales</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
