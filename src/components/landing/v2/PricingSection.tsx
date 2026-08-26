import { useState } from 'react';
import { Check, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PricingPlan } from './types';

interface PricingSectionProps {
  onOpenLead: () => void;
}

export function PricingSection({ onOpenLead }: PricingSectionProps) {
  const [isYearly, setIsYearly] = useState(true);

  const plans: PricingPlan[] = [
    {
      id: 'starter',
      name: 'Starter Property',
      tagline: 'Ideal for independent single-building hostels & PGs up to 60 beds.',
      priceMonthly: 2499,
      priceYearly: 1999,
      features: [
        'Up to 60 Student Residents',
        'Digital Room & Bed Inventory Map',
        'Automated Monthly Rent Generation',
        'Manual WhatsApp Fee Notifications',
        'Daily Roll Call Register',
        'Basic Complaint & Ticket Tracker',
        'Standard Email Support',
      ],
      ctaText: 'Start 14-Day Free Pilot',
    },
    {
      id: 'professional',
      name: 'Professional Multi-Floor',
      tagline: 'For established properties up to 250 beds seeking automated cashflow.',
      priceMonthly: 5999,
      priceYearly: 4799,
      popular: true,
      features: [
        'Up to 250 Student Residents',
        'Interactive Hostel Digital Twin Navigator',
        'Live Student Fee Matrix with Instant Status Tooltips',
        'Automated 1-Click WhatsApp Reminder Broadcasts',
        'Parent OTP Weekend Gate Passes & Curfews',
        'Net Cashflow & Profit/Loss Analyzer',
        'Technician Maintenance SLA Management',
        'Student Mobile Resident Web Portal',
        'Priority Phone & WhatsApp Support',
      ],
      ctaText: 'Choose Professional Plan',
    },
    {
      id: 'enterprise',
      name: 'Enterprise Multi-Branch',
      tagline: 'For large hospitality operators managing 3+ branches or 500+ beds.',
      priceMonthly: 12999,
      priceYearly: 9999,
      features: [
        'Unlimited Residents & Branches',
        'Super Admin Multi-Tenant Control Center',
        'Q2 Natural-Language AI Assistant ("Ask your hostel")',
        'Predictive Occupancy & Cashflow Forecasting',
        'Custom Role-Based Access Control (RBAC)',
        'Dedicated Cloud Database Cluster & 99.98% SLA',
        'Dedicated Onboarding Account Manager',
        'Custom Accounting ERP Integration',
      ],
      ctaText: 'Contact Enterprise Sales',
    },
  ];

  return (
    <section id="pricing" className="py-20 sm:py-28 bg-white border-b border-slate-200/80 text-left">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-purple-50 border border-purple-100 text-purple-700 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Transparent SaaS Pricing</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Simple plans for hostels of every size.
          </h2>
          <p className="text-base sm:text-lg text-slate-600 mt-4 leading-relaxed">
            No hidden setup costs. 14-day free pilot on all plans with fully assisted student data migration.
          </p>

          {/* Billing Switcher Toggle */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <span className={`text-xs font-semibold ${!isYearly ? 'text-slate-900' : 'text-slate-500'}`}>
              Monthly Billing
            </span>
            <button
              onClick={() => setIsYearly(!isYearly)}
              className="w-12 h-6 bg-slate-900 rounded-full p-1 transition-colors relative flex items-center"
              aria-label="Toggle annual pricing"
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  isYearly ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={`text-xs font-semibold flex items-center gap-1.5 ${isYearly ? 'text-purple-700' : 'text-slate-500'}`}>
              <span>Annual Billing</span>
              <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-extrabold text-[10px]">
                Save 20%
              </span>
            </span>
          </div>
        </div>

        {/* 3 Pricing Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {plans.map((plan) => {
            const price = isYearly ? plan.priceYearly : plan.priceMonthly;

            return (
              <div
                key={plan.id}
                className={`p-7 sm:p-8 rounded-3xl border flex flex-col justify-between transition-all duration-200 text-left relative ${
                  plan.popular
                    ? 'bg-gradient-to-b from-purple-50/50 via-white to-slate-50 border-purple-300 shadow-xl ring-2 ring-purple-600/10'
                    : 'bg-[#F8F9FC] border-slate-200/90 hover:border-slate-300 shadow-sm'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-purple-600 text-white font-bold text-[10px] tracking-wider uppercase shadow-sm">
                    Most Popular Choice
                  </div>
                )}

                <div>
                  <div className="mb-4">
                    <h3 className="text-xl font-extrabold text-slate-900">{plan.name}</h3>
                    <p className="text-xs text-slate-500 mt-1 min-h-[32px]">{plan.tagline}</p>
                  </div>

                  {/* Price display */}
                  <div className="flex items-baseline gap-1 my-6 pb-6 border-b border-slate-200/80">
                    <span className="text-4xl font-black text-slate-900">
                      ₹{price.toLocaleString('en-IN')}
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">/ month</span>
                    {isYearly && (
                      <span className="text-[11px] text-purple-700 font-medium ml-2 block">
                        (billed annually)
                      </span>
                    )}
                  </div>

                  {/* Features List */}
                  <div className="space-y-3 mb-8">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      Included Capabilities:
                    </span>
                    {plan.features.map((feat, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-xs font-semibold text-slate-700">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={onOpenLead}
                  className={`w-full h-11 rounded-xl font-bold text-xs shadow-sm transition-all ${
                    plan.popular
                      ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                >
                  <span>{plan.ctaText}</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
