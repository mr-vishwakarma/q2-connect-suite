import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, TrendingUp, AlertTriangle, Clock, ArrowUpRight, MessageSquare, CheckCircle, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MonthData {
  month: string;
  collected: number;
  pending: number;
  overdue: number;
  upcoming: number;
  collectionRate: number;
  overdueCount: number;
  trend: string;
}

const MONTH_STATS: Record<string, MonthData> = {
  May: {
    month: 'May 2026',
    collected: 785000,
    pending: 95000,
    overdue: 42000,
    upcoming: 53000,
    collectionRate: 89.2,
    overdueCount: 5,
    trend: '+4.2% vs April',
  },
  June: {
    month: 'June 2026',
    collected: 812000,
    pending: 110000,
    overdue: 58000,
    upcoming: 52000,
    collectionRate: 88.0,
    overdueCount: 7,
    trend: '+3.4% vs May',
  },
  July: {
    month: 'July 2026',
    collected: 840000,
    pending: 105000,
    overdue: 45000,
    upcoming: 60000,
    collectionRate: 88.9,
    overdueCount: 6,
    trend: '+3.5% vs June',
  },
  August: {
    month: 'August 2026',
    collected: 876500,
    pending: 124000,
    overdue: 68500,
    upcoming: 72000,
    collectionRate: 87.6,
    overdueCount: 8,
    trend: '+4.3% vs July',
  },
};

export function FeeIntelligence() {
  const [selectedMonth, setSelectedMonth] = useState<string>('August');
  const [showBroadcastToast, setShowBroadcastToast] = useState(false);

  const stats = MONTH_STATS[selectedMonth];

  const handleBroadcast = () => {
    setShowBroadcastToast(true);
    setTimeout(() => setShowBroadcastToast(false), 3000);
  };

  return (
    <section id="fee-intelligence" className="py-20 sm:py-28 bg-[#F8F9FC] border-b border-slate-200/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12 text-left">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold mb-4">
              <DollarSign className="w-3.5 h-3.5" />
              <span>Real-Time Cashflow & Receivables</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              Know where your money stands.
            </h2>
            <p className="text-base text-slate-600 mt-2 max-w-xl">
              Eliminate awkward payment calls. Track collections, pending rent, security deposits, and automate reminders over WhatsApp.
            </p>
          </div>

          {/* Month Switcher Selector */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-white border border-slate-200/90 shadow-sm w-fit">
            {Object.keys(MONTH_STATS).map((month) => (
              <button
                key={month}
                onClick={() => setSelectedMonth(month)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  selectedMonth === month
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {month}
              </button>
            ))}
          </div>
        </div>

        {/* Financial KPI Dashboard Cards */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedMonth}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 text-left"
          >
            {/* Collected Card */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase mb-2">
                <span>Collected</span>
                <span className="text-emerald-600 flex items-center text-[11px] font-bold">
                  <TrendingUp className="w-3.5 h-3.5 mr-1" />
                  {stats.trend}
                </span>
              </div>
              <div className="text-3xl font-black text-slate-900">
                ₹{stats.collected.toLocaleString('en-IN')}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Reconciled in bank account for {stats.month}
              </p>
            </div>

            {/* Pending Fees Card */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase mb-2">
                <span>Pending Fees</span>
                <span className="text-rose-600 text-[11px] font-bold">Total Invoices</span>
              </div>
              <div className="text-3xl font-black text-rose-600">
                ₹{stats.pending.toLocaleString('en-IN')}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Includes pending and grace-period rent
              </p>
            </div>

            {/* Overdue Card */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase mb-2">
                <span>Overdue (&gt;5 Days)</span>
                <span className="text-amber-600 text-[11px] font-bold">{stats.overdueCount} Residents</span>
              </div>
              <div className="text-3xl font-black text-amber-600">
                ₹{stats.overdue?.toLocaleString('en-IN')}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Subject to late fee rules
              </p>
            </div>

            {/* Collection Efficiency Rate */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white shadow-lg shadow-purple-600/10">
              <div className="flex items-center justify-between text-xs font-semibold text-purple-200 uppercase mb-2">
                <span>Collection Rate</span>
                <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] text-white">Target: 95%</span>
              </div>
              <div className="text-3xl font-black text-white">
                {stats.collectionRate}%
              </div>
              <p className="text-xs text-purple-100 mt-2">
                Highest on Hyderabad Gachibowli campus
              </p>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Automated WhatsApp Broadcast Action Bar */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/90 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6 text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">
                Automated WhatsApp Reminder Engine
              </h4>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Send personalized WhatsApp payment links with UPI QR code to all {stats.overdueCount} overdue residents with 1 click.
              </p>
            </div>
          </div>

          <Button
            onClick={handleBroadcast}
            className="w-full sm:w-auto px-6 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 shadow-md shadow-emerald-600/20"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            <span>Send Overdue Reminders ({stats.overdueCount})</span>
          </Button>
        </div>

        {/* Toast confirmation */}
        <AnimatePresence>
          {showBroadcastToast && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-slate-900 text-white text-xs shadow-2xl border border-slate-700 flex items-center gap-3"
            >
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="font-bold">WhatsApp Reminders Broadcasted!</p>
                <p className="text-slate-400 text-[11px]">Sent payment links to {stats.overdueCount} overdue residents.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
