import { motion } from 'framer-motion';
import {
  ShieldAlert,
  Building2,
  GraduationCap,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  CreditCard,
  BedDouble,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface RoleSelectorProps {
  onSelectRole: (role: 'super_admin' | 'admin' | 'student') => void;
}

export function RoleSelector({ onSelectRole }: RoleSelectorProps) {
  const roles = [
    {
      id: 'super_admin' as const,
      badge: 'Platform Control',
      badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      title: 'Platform Super Admin',
      subtitle: 'Platform Owner & Governance',
      desc: 'Centralized command center for managing multi-tenant hostel networks, subscriptions, feature flags, and global compliance.',
      icon: ShieldAlert,
      iconWrapClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30 shadow-purple-500/20',
      cardGradient: 'from-purple-900/30 via-card/90 to-background hover:border-purple-500/60 shadow-purple-950/40',
      activeGlow: 'group-hover:shadow-[0_0_40px_rgba(168,85,247,0.25)]',
      btnClass: 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/30',
      features: [
        'Multi-Tenant MRR & ARR Analytics',
        'Organization Onboarding & Suspend',
        'Global Feature Flag Governance',
        'Immutable Audit Trail Logs',
      ],
    },
    {
      id: 'admin' as const,
      badge: 'Operations Hub',
      badgeClass: 'bg-primary/20 text-primary border-primary/40',
      title: 'Hostel Management',
      subtitle: 'Owners, Wardens & Staff',
      desc: 'Complete property cockpit for floor allocations, interactive circular fee matrix, utility expenses, and staff management.',
      icon: Building2,
      iconWrapClass: 'bg-primary/15 text-primary border-primary/30 shadow-primary/20',
      cardGradient: 'from-red-950/40 via-card/90 to-background hover:border-primary shadow-red-950/40',
      activeGlow: 'group-hover:shadow-[0_0_40px_rgba(239,68,68,0.25)]',
      btnClass: 'bg-gradient-to-r from-primary to-rose-600 hover:from-primary/90 hover:to-rose-500 text-primary-foreground shadow-primary/30',
      features: [
        'Interactive Student Fee Matrix',
        'Floor-wise Bed Occupancy Map',
        'Utility Expense & Salary Tracker',
        'Instant Automated PDF Receipts',
      ],
      isPopular: true,
    },
    {
      id: 'student' as const,
      badge: 'Resident Access',
      badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      title: 'Student Resident Portal',
      subtitle: 'Students & Residents',
      desc: 'Mobile-first resident companion to verify room assignments, download monthly payment receipts, and request mess leaves.',
      icon: GraduationCap,
      iconWrapClass: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30 shadow-cyan-500/20',
      cardGradient: 'from-cyan-950/30 via-card/90 to-background hover:border-cyan-500/60 shadow-cyan-950/40',
      activeGlow: 'group-hover:shadow-[0_0_40px_rgba(6,182,212,0.25)]',
      btnClass: 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-600/30',
      features: [
        'Assigned Room & Bed Details',
        'Payment History & Invoices',
        '1-Tap Mess-Off Leave Requests',
        'Laundry Machine Slot Scheduler',
      ],
    },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto space-y-10 px-4">
      {/* Header text */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/80 border border-primary/30 text-[11px] font-bold text-foreground mb-1"
        >
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>Unified SaaS Authentication Gateway</span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl sm:text-5xl font-black text-foreground tracking-tight"
        >
          Welcome to <span className="text-primary">Q2</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-sm sm:text-base text-muted-foreground"
        >
          Choose your workspace role to access your personalized operating portal.
        </motion.p>
      </div>

      {/* 3 Redesigned Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {roles.map((r, idx) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + idx * 0.08, duration: 0.4 }}
            whileHover={{ y: -8, scale: 1.015 }}
            className={`relative rounded-2xl bg-gradient-to-b ${r.cardGradient} border border-border/80 backdrop-blur-2xl p-7 flex flex-col justify-between space-y-6 shadow-2xl transition-all duration-300 group ${r.activeGlow}`}
          >
            {/* Top highlight indicator */}
            {r.isPopular && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-rose-600 text-white font-extrabold text-[10px] uppercase tracking-wider px-3.5 py-1 rounded-full shadow-lg shadow-primary/30 border border-white/20">
                Most Popular
              </div>
            )}

            <div className="space-y-5">
              {/* Icon & Badge */}
              <div className="flex items-center justify-between">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-lg ${r.iconWrapClass} transition-transform group-hover:scale-110 group-hover:rotate-3 duration-300`}
                >
                  <r.icon className="w-7 h-7" />
                </div>
                <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 ${r.badgeClass}`}>
                  {r.badge}
                </Badge>
              </div>

              {/* Title & Subtitle */}
              <div>
                <h3 className="text-2xl font-black text-foreground tracking-tight group-hover:text-primary transition-colors">
                  {r.title}
                </h3>
                <p className="text-xs font-semibold text-muted-foreground mt-0.5">{r.subtitle}</p>
              </div>

              {/* Description */}
              <p className="text-xs text-muted-foreground leading-relaxed">
                {r.desc}
              </p>

              {/* Feature Checklist */}
              <div className="space-y-2 pt-2 border-t border-border/50">
                {r.features.map((feat) => (
                  <div key={feat} className="flex items-center gap-2 text-xs text-foreground/90">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Launch Button */}
            <div className="pt-4 border-t border-border/50">
              <Button
                onClick={() => onSelectRole(r.id)}
                className={`w-full font-bold text-xs shadow-lg h-11 rounded-xl flex items-center justify-center gap-2 ${r.btnClass} transition-all duration-300 group-hover:gap-3`}
              >
                <span>Launch {r.title.split(' ')[0]} Sign In</span>
                <ArrowRight className="w-4 h-4 transition-transform" />
              </Button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
