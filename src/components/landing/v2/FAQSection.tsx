import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, HelpCircle, Sparkles } from 'lucide-react';
import { FAQItem } from './types';

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs: FAQItem[] = [
    {
      question: 'How quickly can I set up my hostel on Q2?',
      answer:
        'You can go live in under 2 hours. Our onboarding team provides a spreadsheet template to import your building layout, rooms, beds, active students, and pending fee balances with 1 click.',
      category: 'General',
    },
    {
      question: 'Can I migrate our existing student and fee data from Excel?',
      answer:
        'Yes. Q2 includes an automated CSV/Excel importer that validates mobile numbers, room numbers, and deposit amounts. We also offer white-glove assisted data migration for all new properties.',
      category: 'General',
    },
    {
      question: 'Can I manage multiple hostel branches from one account?',
      answer:
        'Absolutely. The Super Admin Console allows multi-property operators to view aggregated collection rates, compare branch occupancy, and switch between branches with a single click.',
      category: 'Operations',
    },
    {
      question: 'Can different staff members have different permissions?',
      answer:
        'Yes. You can assign granular roles: Wardens handle roll calls and gate passes, Accountants manage fee reconciliations and expenses, while Security Staff verify gate entry/exit logs.',
      category: 'Security',
    },
    {
      question: 'How do students pay rent online?',
      answer:
        'Residents receive automated WhatsApp notices with direct UPI intent links and dynamic QR codes. Once payment succeeds, the system automatically marks the invoice as Paid and sends a GST receipt.',
      category: 'Billing',
    },
    {
      question: 'How does Q2 protect our student and financial data?',
      answer:
        'All data is encrypted in transit and at rest using bank-grade AES-256 encryption on dedicated MongoDB Atlas clusters. Every tenant is strictly isolated to prevent data leakage.',
      category: 'Security',
    },
    {
      question: 'Can we add or disable features as our property grows?',
      answer:
        'Yes. Q2 uses dynamic Feature Flags. You can enable Attendance, Laundry, Maintenance SLA, or the AI Assistant module anytime from your Organization Settings without software redeployments.',
      category: 'Operations',
    },
  ];

  return (
    <section className="py-20 sm:py-28 bg-[#F8F9FC] border-b border-slate-200/80 text-left">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-purple-50 border border-purple-100 text-purple-700 text-xs font-semibold mb-4">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Got Questions?</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Frequently asked questions.
          </h2>
          <p className="text-base text-slate-600 mt-4 leading-relaxed">
            Everything you need to know about migrating your property to the Q2 operating system.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;

            return (
              <div
                key={idx}
                className="rounded-2xl bg-white border border-slate-200/90 shadow-sm overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <span className="text-base font-bold text-slate-900 leading-snug">
                    {faq.question}
                  </span>
                  <div
                    className={`w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 bg-purple-100 text-purple-700' : ''
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-6 sm:px-6 pt-1 text-sm text-slate-600 leading-relaxed border-t border-slate-100">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
