import { Building, UserPlus, Zap, LineChart, CheckCircle2 } from 'lucide-react';

export function HowItWorks() {
  const steps = [
    {
      num: '01',
      title: 'Configure Your Property',
      desc: 'Set up building branches, floors, room sharing tiers (Single/Double/Triple), and monthly rent matrices in 15 minutes.',
      icon: Building,
      badge: '15 Min Setup',
    },
    {
      num: '02',
      title: 'Onboard Students & KYC',
      desc: 'Import existing spreadsheets with 1 click or send digital KYC self-onboarding links directly to student WhatsApp numbers.',
      icon: UserPlus,
      badge: '1-Click CSV Import',
    },
    {
      num: '03',
      title: 'Automate Everyday Operations',
      desc: 'Automated invoice generation, 1-click WhatsApp reminders, daily digital roll calls, and mobile gate pass approvals.',
      icon: Zap,
      badge: 'Zero Manual Tasks',
    },
    {
      num: '04',
      title: 'Grow with Live Intelligence',
      desc: 'Track Net Operating Surplus, upcoming vacancy forecasts, and profit margins to scale across multiple branches.',
      icon: LineChart,
      badge: 'Audit & Tax Ready',
    },
  ];

  return (
    <section className="py-20 sm:py-28 bg-[#F8F9FC] border-b border-slate-200/80 text-left">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-teal-50 border border-teal-100 text-teal-700 text-xs font-semibold mb-4">
            <span>Streamlined Onboarding</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            How Q2 transforms your hostel.
          </h2>
          <p className="text-base sm:text-lg text-slate-600 mt-4 leading-relaxed">
            Go live in less than a day. Our onboarding team helps you migrate all existing student data seamlessly.
          </p>
        </div>

        {/* 4 Steps Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={idx}
                className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 transition-all text-left"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-2xl font-black text-purple-600 font-mono">
                      {step.num}
                    </span>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                      {step.badge}
                    </span>
                  </div>

                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    {step.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {step.desc}
                  </p>
                </div>

                <div className="pt-4 mt-6 border-t border-slate-100 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Fully Assisted Migration</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
