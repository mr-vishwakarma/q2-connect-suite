import { motion } from 'framer-motion';
import { ShieldAlert, Building2, GraduationCap, ArrowRight } from 'lucide-react';

interface RoleSelectorProps {
  onSelectRole: (role: 'super_admin' | 'admin' | 'student') => void;
}

export function RoleSelector({ onSelectRole }: RoleSelectorProps) {
  const roles = [
    {
      id: 'super_admin' as const,
      title: 'Platform Super Admin',
      subtitle: 'Platform Owner',
      desc: 'Centralized control for multi-tenant network, subscriptions, plans & tenant onboarding.',
      icon: ShieldAlert,
      color: 'purple',
      badge: 'Platform Control',
    },
    {
      id: 'admin' as const,
      title: 'Hostel Management',
      subtitle: 'Hostel Admin / Warden / Staff',
      desc: 'Manage room occupancy, fee matrix ledgers, utility expenses, and resident services.',
      icon: Building2,
      color: 'primary',
      badge: 'Operations Portal',
    },
    {
      id: 'student' as const,
      title: 'Student Resident Portal',
      subtitle: 'Residents & Students',
      desc: 'Check room & roommates, verify monthly fee status, download receipts & request leaves.',
      icon: GraduationCap,
      color: 'sky',
      badge: 'Resident Access',
    },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <motion.h2
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl sm:text-4xl font-black text-foreground tracking-tight"
        >
          Welcome to Q2
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-sm sm:text-base text-muted-foreground"
        >
          Choose how you want to continue to your workspace.
        </motion.p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {roles.map((r, idx) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + idx * 0.08 }}
            whileHover={{ y: -6, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectRole(r.id)}
            className="cursor-pointer bg-card/80 backdrop-blur-xl border border-border/80 hover:border-primary/60 rounded-2xl p-6 flex flex-col justify-between space-y-4 shadow-lg hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 group"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    r.color === 'purple'
                      ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                      : r.color === 'sky'
                      ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                      : 'bg-primary/10 text-primary border border-primary/30'
                  }`}
                >
                  <r.icon className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase px-2.5 py-1 rounded-full bg-secondary/80 border border-border/50">
                  {r.badge}
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                  {r.title}
                </h3>
                <span className="text-xs font-semibold text-muted-foreground">{r.subtitle}</span>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {r.desc}
              </p>
            </div>

            <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs font-bold text-primary group-hover:translate-x-1 transition-transform">
              <span>Continue to Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
