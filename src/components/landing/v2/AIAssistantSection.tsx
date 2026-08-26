import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, Bot, User, CornerDownRight, CheckCircle2, TrendingUp, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QueryPreset {
  question: string;
  answerTitle: string;
  answerSummary: string;
  bullets: string[];
  metrics: { label: string; val: string; color: string }[];
}

const PRESETS: QueryPreset[] = [
  {
    question: 'How much fee is still pending?',
    answerTitle: 'Fee Receivables Analysis',
    answerSummary: '₹1,24,000 is currently pending across 12 residents.',
    bullets: [
      '8 residents are overdue by more than 7 days (₹68,500 total).',
      'Floor 3 has the highest outstanding balance: ₹27,500.',
      'Automated WhatsApp payment links have been scheduled for 6:00 PM today.',
    ],
    metrics: [
      { label: 'Pending Total', val: '₹1,24,000', color: 'text-rose-600' },
      { label: 'Overdue >7 Days', val: '8 Students', color: 'text-amber-600' },
      { label: 'Expected Recovery', val: '₹95,000', color: 'text-emerald-600' },
    ],
  },
  {
    question: 'Which rooms will become vacant next month?',
    answerTitle: 'Vacancy & Checkout Forecast',
    answerSummary: '12 beds across 5 rooms are scheduled for checkout by September 30.',
    bullets: [
      'Room A-102 (2 Beds) - TCS batch completion checkout.',
      'Room B-205 (1 Bed) - Internship semester relocation.',
      'Room C-304 (Single Premium) - Course completed.',
      'Recommended Action: Publish availability to waitlisted student inquiries.',
    ],
    metrics: [
      { label: 'Upcoming Vacancies', val: '12 Beds', color: 'text-purple-600' },
      { label: 'Pipeline Waitlist', val: '18 Students', color: 'text-teal-600' },
      { label: 'Projected Loss', val: '₹0 (100% Demand)', color: 'text-emerald-600' },
    ],
  },
  {
    question: 'Why did collection fall this month?',
    answerTitle: 'Revenue Trend Diagnostics',
    answerSummary: 'Collection rate fell slightly by 1.3% compared to previous month target.',
    bullets: [
      'Engineering semester break caused 6 residents to submit delayed fees.',
      'Mess rebate adjustments reduced net monthly collection by ₹18,200.',
      'Zero defaults detected; all balances are scheduled for clearance next week.',
    ],
    metrics: [
      { label: 'Collection Variance', val: '-1.3%', color: 'text-amber-600' },
      { label: 'Delayed Semester Fees', val: '₹42,000', color: 'text-rose-600' },
      { label: 'Rebate Deductions', val: '₹18,200', color: 'text-slate-700' },
    ],
  },
  {
    question: 'Which floor has the highest maintenance cost?',
    answerTitle: 'Operational Cost Breakdown',
    answerSummary: 'Floor 2 accounts for 44% of total maintenance expenditure this quarter.',
    bullets: [
      '3 AC compressor overhauls in Room B-201 and B-204 (₹14,500).',
      'Plumbing pipeline valve replacement in common washroom (₹4,200).',
      'All major repairs are covered under 1-year contractor warranty.',
    ],
    metrics: [
      { label: 'Floor 2 Maintenance', val: '₹18,700', color: 'text-purple-600' },
      { label: 'Average Floor Cost', val: '₹8,400', color: 'text-slate-700' },
      { label: 'Under Warranty', val: '100%', color: 'text-emerald-600' },
    ],
  },
];

export function AIAssistantSection() {
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0);
  const [isTyping, setIsTyping] = useState<boolean>(false);

  const current = PRESETS[selectedPresetIndex];

  const handleSelectQuery = (idx: number) => {
    if (idx === selectedPresetIndex) return;
    setIsTyping(true);
    setTimeout(() => {
      setSelectedPresetIndex(idx);
      setIsTyping(false);
    }, 300);
  };

  return (
    <section id="ai-assistant" className="py-20 sm:py-28 bg-white border-b border-slate-200/80 text-left">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-purple-50 border border-purple-100 text-purple-700 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Autonomous Intelligence Layer</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Ask your hostel anything.
          </h2>
          <p className="text-base sm:text-lg text-slate-600 mt-4 leading-relaxed">
            Stop digging through sheets and registers. Ask natural questions and get instant financial diagnostics, occupancy forecasts, and operational insights.
          </p>
        </div>

        {/* Interactive Query Chips */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
          {PRESETS.map((preset, idx) => {
            const isSelected = selectedPresetIndex === idx;
            return (
              <button
                key={idx}
                onClick={() => handleSelectQuery(idx)}
                className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all border ${
                  isSelected
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/20'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-purple-300 hover:bg-purple-50/50'
                }`}
              >
                <span>“{preset.question}”</span>
              </button>
            );
          })}
        </div>

        {/* Simulated AI Assistant Chat Window */}
        <div className="max-w-4xl mx-auto bg-[#F8F9FC] rounded-3xl border border-slate-200/90 shadow-xl p-6 sm:p-8 overflow-hidden text-left">
          {/* Top Assistant header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Q2 Intelligence Assistant</h4>
                <p className="text-[11px] text-slate-500">Connected to live MongoDB tenant database</p>
              </div>
            </div>
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold border border-emerald-200">
              Active Context
            </span>
          </div>

          {/* User Prompt bubble */}
          <div className="flex items-start gap-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-sm font-semibold text-slate-800 shadow-sm">
              {current.question}
            </div>
          </div>

          {/* Assistant Response Card */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              <Bot className="w-4 h-4" />
            </div>

            <div className="flex-1 p-5 sm:p-6 rounded-3xl bg-white border border-purple-200/90 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">
                  {current.answerTitle}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Real-time compute (0.24s)</span>
              </div>

              <h5 className="text-base font-extrabold text-slate-900 mb-3">
                {current.answerSummary}
              </h5>

              {/* Metric Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
                {current.metrics.map((m, i) => (
                  <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">{m.label}</span>
                    <span className={`text-sm font-black ${m.color}`}>{m.val}</span>
                  </div>
                ))}
              </div>

              {/* Detailed Bullets */}
              <div className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                {current.bullets.map((b, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CornerDownRight className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
