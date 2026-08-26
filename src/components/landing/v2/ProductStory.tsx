import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  BedDouble,
  CreditCard,
  Wrench,
  BarChart3,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export function ProductStory() {
  const [activeTab, setActiveTab] = useState<number>(0);

  const pillars = [
    {
      id: 'students',
      label: 'Students',
      icon: Users,
      headline: 'Complete resident lifecycle from onboarding to alumni checkout',
      description:
        'Digital KYC onboarding, room allocation, guardian contacts, biometric roll calls, gate passes, and automated leave notices in one secure directory.',
      metrics: ['248 Enrolled Residents', '98.5% Digital KYC Complete', 'Instant Gate Pass Check-in'],
      previewTitle: 'Resident Central Directory',
      previewDetails: {
        item1: 'Profile: Kajal Sharma (Room A-204)',
        item2: 'Emergency: +91 98450 11224 (Father)',
        item3: 'Security Deposit: ₹10,000 Verified',
        status: 'Active Resident',
      },
    },
    {
      id: 'rooms',
      label: 'Rooms & Beds',
      icon: BedDouble,
      headline: 'Live visual twin of every floor, room, and vacant mattress',
      description:
        'Eliminate double-booking and messy chart spreadsheets. Track double, triple, and premium single occupancy with real-time vacancy forecasts.',
      metrics: ['92.4% Occupancy', '12 Beds Vacant for Next Month', '3 Hostels Synchronized'],
      previewTitle: 'Live Room Grid Matrix',
      previewDetails: {
        item1: 'Room 204: 3/3 Beds Occupied',
        item2: 'Room 205: 2/3 Beds (Bed #3 Vacant)',
        item3: 'Yield: ₹25,500 / month',
        status: 'Optimal Allocation',
      },
    },
    {
      id: 'payments',
      label: 'Payments & Fees',
      icon: CreditCard,
      headline: 'Automated rent collection with 1-click WhatsApp alerts',
      description:
        'Automated monthly fee generation, UPI QR integration, instant GST receipts, overdue reminders, and real-time bank reconciliation.',
      metrics: ['₹8.76L Collected This Month', '1-Click WhatsApp Broadcasts', 'Instant PDF Invoices'],
      previewTitle: 'Automated Fee Engine',
      previewDetails: {
        item1: 'Collection Rate: 87.6% (On Track)',
        item2: 'Pending: 4 Students (₹34,000)',
        item3: 'Late Fee Waiver: Automated Rules',
        status: 'Reconciled Today',
      },
    },
    {
      id: 'operations',
      label: 'Operations & Maintenance',
      icon: Wrench,
      headline: 'Fix plumbing, AC, and electrical issues before residents complain',
      description:
        'Residents raise tickets with photos from their phone. Wardens assign technicians with SLA tracking and proof-of-work closure.',
      metrics: ['94% Same-Day SLA Resolution', '18 Active Maintenance Tickets', '4 Staff Members Assigned'],
      previewTitle: 'Smart Maintenance Desk',
      previewDetails: {
        item1: 'Ticket #402: Geyser Sensor in B-302',
        item2: 'Technician: Suresh K. (Assigned)',
        item3: 'Priority: High (Resolved in 2.4 hrs)',
        status: 'SLA Met',
      },
    },
    {
      id: 'analytics',
      label: 'Analytics & P&L',
      icon: BarChart3,
      headline: 'Real-time Net Cashflow, Operating Costs, and Profit Margins',
      description:
        'Compare rent collections against electricity bills, grocery supplies, and staff payroll to see true operating profit per branch.',
      metrics: ['68.4% Net Operating Margin', '₹5.98L Net Surplus', 'Live Category Cost Meters'],
      previewTitle: 'Executive Cashflow Dashboard',
      previewDetails: {
        item1: 'Gross Inflow: ₹8,76,500',
        item2: 'Operating Outflow: ₹2,78,000',
        item3: 'Projected Net Margin: 68.4%',
        status: 'Audit Ready',
      },
    },
  ];

  const currentPillar = pillars[activeTab];
  const IconComponent = currentPillar.icon;

  return (
    <section id="platform" className="py-20 sm:py-28 bg-[#F8F9FC] border-y border-slate-200/70 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-purple-50 border border-purple-100 text-purple-700 text-xs font-semibold mb-4">
            <span>Unified SaaS Architecture</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            One platform for the entire hostel.
          </h2>
          <p className="text-base sm:text-lg text-slate-600 mt-4 leading-relaxed">
            Eliminate fragmented tools. Connect student check-ins, room inventories, payment reconciliations, and staff tasks in a single operating system.
          </p>
        </div>

        {/* Interactive Tab Selector */}
        <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-4 no-scrollbar mb-10">
          {pillars.map((p, idx) => {
            const PIcon = p.icon;
            const isActive = activeTab === idx;
            return (
              <button
                key={p.id}
                onClick={() => setActiveTab(idx)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all duration-150 shrink-0 border ${
                  isActive
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/20'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-purple-200 hover:bg-purple-50/50'
                }`}
              >
                <PIcon className="w-4 h-4" />
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>

        {/* Pillar Showcase Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPillar.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-10 shadow-[0_10px_30px_rgba(15,23,42,0.04)] text-left"
          >
            {/* Left Narrative Column */}
            <div className="lg:col-span-6 space-y-6">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-sm">
                <IconComponent className="w-6 h-6" />
              </div>

              <div>
                <span className="text-xs font-bold text-purple-600 uppercase tracking-wider block mb-1">
                  Core Module {activeTab + 1} of 5
                </span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug">
                  {currentPillar.headline}
                </h3>
              </div>

              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                {currentPillar.description}
              </p>

              {/* Bullet Metrics */}
              <div className="space-y-2.5 pt-2">
                {currentPillar.metrics.map((m, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-slate-800">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>{m}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Interactive UI Preview Column */}
            <div className="lg:col-span-6">
              <div className="rounded-2xl bg-slate-900 text-white p-6 shadow-xl border border-slate-800 relative overflow-hidden">
                {/* Top header badge */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                    <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                    <span className="text-xs font-mono text-slate-400 ml-2">{currentPillar.previewTitle}</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                    {currentPillar.previewDetails.status}
                  </span>
                </div>

                {/* Simulated Product UI rows */}
                <div className="space-y-3 mt-5">
                  <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between text-xs">
                    <span className="text-slate-300">{currentPillar.previewDetails.item1}</span>
                    <span className="text-purple-400 font-bold">Synced</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between text-xs">
                    <span className="text-slate-300">{currentPillar.previewDetails.item2}</span>
                    <span className="text-teal-400 font-bold">Verified</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between text-xs">
                    <span className="text-slate-300">{currentPillar.previewDetails.item3}</span>
                    <span className="text-emerald-400 font-bold">Compliant</span>
                  </div>
                </div>

                {/* Bottom interactive action */}
                <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>Q2 Multi-Tenant Cluster</span>
                  <span className="text-purple-300 font-medium">99.98% SLA Availability</span>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
