import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Building2, GraduationCap, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AuthRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthRoleModal({ isOpen, onClose }: AuthRoleModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleRoleSelect = (role: 'superadmin' | 'admin' | 'student') => {
    onClose();
    navigate(`/login?role=${role}`);
  };

  const roles = [
    {
      id: 'superadmin' as const,
      title: 'Platform Super Admin',
      subtitle: 'Manage multi-tenant organizations, subscription tiers & audit logs',
      badge: 'Enterprise Platform',
      icon: ShieldCheck,
      color: 'from-purple-500/10 to-indigo-500/10 border-purple-200 text-purple-700',
      iconBg: 'bg-purple-100 text-purple-700',
      tag: 'Platform Ops',
    },
    {
      id: 'admin' as const,
      title: 'Hostel Admin / Warden',
      subtitle: 'Daily roll call, rooms, fees, expenses, alerts & complaint resolution',
      badge: 'Property Management',
      icon: Building2,
      color: 'from-teal-500/10 to-emerald-500/10 border-teal-200 text-teal-700',
      iconBg: 'bg-teal-100 text-teal-700',
      tag: 'Branch Operations',
    },
    {
      id: 'student' as const,
      title: 'Student / Resident Portal',
      subtitle: 'Check fee receipts, request gate passes, mess leaves & report issues',
      badge: 'Resident Access',
      icon: GraduationCap,
      color: 'from-blue-500/10 to-cyan-500/10 border-blue-200 text-blue-700',
      iconBg: 'bg-blue-100 text-blue-700',
      tag: 'Resident App',
    },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200/80 p-6 sm:p-8 z-10 overflow-hidden"
        >
          {/* Top Decorative bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-600 via-teal-500 to-indigo-600" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="text-left mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 border border-purple-100 text-purple-700 text-xs font-semibold mb-3">
              <span>Q2 Universal Gateway</span>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Select your portal</h3>
            <p className="text-sm text-slate-500 mt-1">
              Choose your role to access the corresponding dashboard and operations console.
            </p>
          </div>

          {/* Role Cards */}
          <div className="space-y-3">
            {roles.map((r) => {
              const Icon = r.icon;
              return (
                <button
                  key={r.id}
                  onClick={() => handleRoleSelect(r.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 flex items-center justify-between group hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-r ${r.color} hover:border-slate-300`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${r.iconBg}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-slate-900 group-hover:text-purple-700 transition-colors">
                          {r.title}
                        </h4>
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/80 border border-slate-200/60 text-slate-600">
                          {r.tag}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5 max-w-sm line-clamp-1">
                        {r.subtitle}
                      </p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white border border-slate-200/80 flex items-center justify-center text-slate-400 group-hover:text-purple-600 group-hover:border-purple-300 transition-all shrink-0 ml-3">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer note */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Need hostel management software for your organization?{' '}
              <a href="#pricing" onClick={onClose} className="text-purple-600 font-semibold hover:underline">
                View SaaS Plans
              </a>
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
