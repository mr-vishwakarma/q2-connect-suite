import { useState } from 'react';
import {
  Users,
  BedDouble,
  CreditCard,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Wrench,
  Receipt,
  ClipboardList,
  FileSpreadsheet,
  BarChart3,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

export function FeatureGrid() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const features = [
    {
      icon: Users,
      title: 'Student Management',
      description: 'Digital KYC onboarding, emergency contacts, parent verification, and student documents.',
      preview: 'Digital ID & Roommates Verified',
      color: 'bg-purple-100 text-purple-700',
    },
    {
      icon: BedDouble,
      title: 'Room & Bed Management',
      description: 'Visual occupancy matrix, double/triple allocation, and vacancy alerts across all floors.',
      preview: 'Live Floor Twin & Bed Availability',
      color: 'bg-indigo-100 text-indigo-700',
    },
    {
      icon: CreditCard,
      title: 'Automated Fee Collection',
      description: 'Automated invoice generation, UPI QR integration, and 1-click WhatsApp payment reminders.',
      preview: 'Zero Manual Reconciliation',
      color: 'bg-emerald-100 text-emerald-700',
    },
    {
      icon: ShieldCheck,
      title: 'Security Deposit Tracking',
      description: 'Track caution money, automated damage deductions, and checkout deposit refund ledger.',
      preview: 'Instant Checkout Clearance',
      color: 'bg-teal-100 text-teal-700',
    },
    {
      icon: UserCheck,
      title: 'Attendance & Gate Passes',
      description: 'Daily roll calls, curfew checks, and parent-approved overnight weekend gate passes.',
      preview: 'Parent OTP Approved Passes',
      color: 'bg-blue-100 text-blue-700',
    },
    {
      icon: UserPlus,
      title: 'Visitor Management',
      description: 'Digital parent & visitor registration with real-time entry/exit logs and security badges.',
      preview: 'Digital Check-in Security Badge',
      color: 'bg-cyan-100 text-cyan-700',
    },
    {
      icon: Wrench,
      title: 'Maintenance & Helpdesk',
      description: 'Photo-enabled complaint logging, technician assignments, and SLA resolution timers.',
      preview: '94% Same-Day SLA Turnaround',
      color: 'bg-rose-100 text-rose-700',
    },
    {
      icon: Receipt,
      title: 'Expense & Cashflow Analyzer',
      description: 'Track electricity, water, groceries, and staff payroll against monthly fee collections.',
      preview: 'Live Net Profit & Loss Margin',
      color: 'bg-amber-100 text-amber-700',
    },
    {
      icon: ClipboardList,
      title: 'Staff & Warden Tasks',
      description: 'Shift handovers, cleaning checklists, mess headcount audits, and security compliance.',
      preview: 'Warden Checklists & Audit Logs',
      color: 'bg-violet-100 text-violet-700',
    },
    {
      icon: FileSpreadsheet,
      title: 'GST Invoices & Reports',
      description: '1-click export of GST-compliant tax invoices, monthly ledgers, and bank summaries.',
      preview: 'Instant CA & Audit Export (CSV/PDF)',
      color: 'bg-slate-100 text-slate-700',
    },
    {
      icon: BarChart3,
      title: 'Predictive Analytics',
      description: 'Occupancy trends, collection forecasts, bed turnover rates, and revenue-at-risk meters.',
      preview: 'Real-time Yield & Forecasts',
      color: 'bg-emerald-100 text-emerald-700',
    },
    {
      icon: MessageSquare,
      title: 'Broadcasts & Notices',
      description: 'Instant announcements for mess menus, festival celebrations, and emergency alerts.',
      preview: 'Direct Resident App Broadcasts',
      color: 'bg-fuchsia-100 text-fuchsia-700',
    },
  ];

  return (
    <section id="features" className="py-20 sm:py-28 bg-white border-b border-slate-200/80 text-left">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-purple-50 border border-purple-100 text-purple-700 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Complete Feature Suite</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Engineered for every hostel workflow.
          </h2>
          <p className="text-base sm:text-lg text-slate-600 mt-4 leading-relaxed">
            12 deep, purpose-built modules designed to replace all disjointed software, paper files, and WhatsApp chats.
          </p>
        </div>

        {/* 12 Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            const isHovered = hoveredIndex === idx;

            return (
              <div
                key={idx}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`p-6 rounded-3xl border transition-all duration-200 text-left flex flex-col justify-between ${
                  isHovered
                    ? 'bg-gradient-to-br from-purple-50/40 via-white to-slate-50 border-purple-300 shadow-lg -translate-y-1'
                    : 'bg-[#F8F9FC] border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-200 ${feat.color} ${isHovered ? 'scale-110' : ''}`}>
                    <Icon className="w-5 h-5" />
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    {feat.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                    {feat.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs">
                  <span className="font-semibold text-purple-700">{feat.preview}</span>
                  <span className="text-slate-400 font-mono text-[11px]">Module {idx + 1}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
