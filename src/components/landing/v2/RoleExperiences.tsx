import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Building2, Smartphone, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RoleExperiencesProps {
  onOpenAuth: () => void;
}

export function RoleExperiences({ onOpenAuth }: RoleExperiencesProps) {
  const [activeRole, setActiveRole] = useState<'superadmin' | 'admin' | 'student'>('admin');

  const roles = [
    {
      id: 'superadmin' as const,
      label: 'Super Admin',
      icon: ShieldCheck,
      headline: 'Enterprise Control Across All Multi-City Organizations',
      subheading:
        'Manage tenant isolation, multi-branch licenses, subscription quotas, feature flags, and cross-property financial audits from one central command center.',
      capabilities: [
        'Multi-Tenant Tenant Isolation & Slug Routing',
        'SaaS Subscription Plan Metering & Quotas',
        'Feature Flag Toggles (Instant Live Sync)',
        'Global Security Audit Trail & Access Logs',
      ],
      previewHeadline: 'Q2 SaaS Multi-Tenant Command Center',
      previewStats: [
        { label: 'Active Organizations', val: '12 Enterprises' },
        { label: 'Total Managed Beds', val: '4,850 Beds' },
        { label: 'Network Monthly Inflow', val: '₹1.84 Cr' },
      ],
      buttonText: 'Launch Super Admin Console',
    },
    {
      id: 'admin' as const,
      label: 'Hostel Admin & Warden',
      icon: Building2,
      headline: 'The Calm Operating System for Every Day on Property',
      subheading:
        'Eliminate chaotic WhatsApp groups and paper registers. Manage room bookings, automated rent invoices, daily roll calls, staff tasks, and profit & loss statements.',
      capabilities: [
        'Live Student Fee Matrix & Overdue Broadcasts',
        'Room & Bed Availability Map with Digital Twin',
        'Daily Roll Call & Evening Gate Pass Verification',
        'Net Cashflow & Profit/Loss Financial Analyzer',
      ],
      previewHeadline: 'Hostel Property Console • Gachibowli',
      previewStats: [
        { label: 'Residents Checked-In', val: '248 / 248' },
        { label: 'Collection Rate', val: '87.6%' },
        { label: 'Open Maintenance', val: '2 Urgent' },
      ],
      buttonText: 'Access Hostel Admin Portal',
    },
    {
      id: 'student' as const,
      label: 'Student Resident Portal',
      icon: Smartphone,
      headline: 'Everything About Your Stay in One Clean Mobile Experience',
      subheading:
        'Residents get a modern mobile-optimized portal to pay rent securely, download GST fee receipts, request weekend gate passes, notify mess off, and report maintenance issues.',
      capabilities: [
        'Instant UPI Rent Payments & Receipt Downloads',
        'Weekend Overnight Gate Pass Requests (Parent OTP)',
        'Mess-Off Rebate Notices with Auto-Deductions',
        'Photo-Enabled Maintenance Ticket Tracker',
      ],
      previewHeadline: 'Resident Mobile Web App • Verified ID',
      previewStats: [
        { label: 'Assigned Room', val: 'A-204 (Triple AC)' },
        { label: 'Next Rent Due', val: '05 Sept • ₹8,500' },
        { label: 'Gate Pass Status', val: 'Approved' },
      ],
      buttonText: 'Open Student Resident Portal',
    },
  ];

  const current = roles.find((r) => r.id === activeRole)!;
  const CurrentIcon = current.icon;

  return (
    <section id="student-portal" className="py-20 sm:py-28 bg-[#F8F9FC] border-b border-slate-200/80 text-left">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Persona Architecture</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Built for everyone who makes a hostel work.
          </h2>
          <p className="text-base sm:text-lg text-slate-600 mt-4 leading-relaxed">
            Tailored consoles for platform executives, property wardens, and student residents.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center justify-center gap-3 mb-10">
          {roles.map((r) => {
            const Icon = r.icon;
            const isSelected = activeRole === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setActiveRole(r.id)}
                className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all border ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{r.label}</span>
              </button>
            );
          })}
        </div>

        {/* Active Role Content Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeRole}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-10 shadow-sm"
          >
            {/* Left Description Column */}
            <div className="lg:col-span-6 space-y-6">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <CurrentIcon className="w-6 h-6" />
              </div>

              <div>
                <span className="text-xs font-bold text-purple-600 uppercase tracking-wider block mb-1">
                  {current.label} Experience
                </span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug">
                  {current.headline}
                </h3>
              </div>

              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                {current.subheading}
              </p>

              <div className="space-y-2.5 pt-2">
                {current.capabilities.map((cap, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-slate-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{cap}</span>
                  </div>
                ))}
              </div>

              <Button
                onClick={onOpenAuth}
                className="mt-4 bg-slate-900 hover:bg-purple-600 text-white font-semibold text-xs px-6 h-11 rounded-xl shadow-sm transition-all"
              >
                <span>{current.buttonText}</span>
                <ArrowRight className="w-3.5 h-3.5 ml-2" />
              </Button>
            </div>

            {/* Right Simulated Dashboard Preview Column */}
            <div className="lg:col-span-6">
              <div className="rounded-3xl bg-slate-950 text-white p-6 sm:p-8 shadow-2xl border border-slate-800 relative overflow-hidden">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <span className="text-xs font-mono text-purple-400 font-bold">{current.previewHeadline}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-6">
                  {current.previewStats.map((stat, i) => (
                    <div key={i} className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-left">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-1">
                        {stat.label}
                      </span>
                      <span className="text-sm font-extrabold text-white">{stat.val}</span>
                    </div>
                  ))}
                </div>

                {/* Supporting image showcase */}
                <div className="rounded-2xl overflow-hidden border border-slate-800 relative">
                  <img
                    src={activeRole === 'student' ? '/assets/student-lifestyle.jpg' : '/assets/hostel-lifestyle.jpg'}
                    alt="Q2 Platform Preview"
                    className="w-full h-44 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end p-4">
                    <span className="text-xs text-slate-200 font-medium">
                      Live Q2 Platform Experience • Tested by 200+ Operators
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
