import { TrendingUp, AlertTriangle, Users, DollarSign, Sparkles, CheckCircle2 } from 'lucide-react';

export function SmartInsights() {
  const insights = [
    {
      title: 'Expected Month-End Collection',
      value: '₹9.84L',
      badge: '98.2% Projected',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      description: 'Based on historical on-time payment trajectories across 248 enrolled residents.',
      icon: DollarSign,
      iconBg: 'bg-emerald-100 text-emerald-700',
    },
    {
      title: 'Projected Occupancy (Next Quarter)',
      value: '91.4%',
      badge: '+3.2% vs Last Quarter',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
      description: 'Factoring in current pipeline deposits and upcoming college semester intakes.',
      icon: TrendingUp,
      iconBg: 'bg-purple-100 text-purple-700',
    },
    {
      title: 'Expected Vacancies Next Month',
      value: '12 Beds',
      badge: 'Waitlist: 18 Students',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      description: 'Automated allocation rules will immediately notify verified incoming candidates.',
      icon: Users,
      iconBg: 'bg-blue-100 text-blue-700',
    },
    {
      title: 'Revenue at Risk (Unpaid Overdue)',
      value: '₹48,000',
      badge: 'Immediate Action Triggered',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
      description: '3 accounts flagged for follow-up; automated WhatsApp notice already queued.',
      icon: AlertTriangle,
      iconBg: 'bg-rose-100 text-rose-700',
    },
  ];

  return (
    <section className="py-20 sm:py-28 bg-[#F8F9FC] border-b border-slate-200/80 text-left">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-teal-50 border border-teal-100 text-teal-700 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Forward-Looking Intelligence</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Q2 doesn't just show what happened.{' '}
            <span className="text-purple-600">It helps you understand what's next.</span>
          </h2>
          <p className="text-base sm:text-lg text-slate-600 mt-4 leading-relaxed">
            Predictive machine-learning metrics that forecast bed turnover, collection risks, and upcoming cashflow bottlenecks.
          </p>
        </div>

        {/* 4 Predictive Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {insights.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-left flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${item.iconBg}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  </div>

                  <span className="text-xs font-semibold text-slate-500 block mb-1">
                    {item.title}
                  </span>
                  <div className="text-3xl font-black text-slate-900 mb-3">
                    {item.value}
                  </div>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed pt-3 border-t border-slate-100">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
