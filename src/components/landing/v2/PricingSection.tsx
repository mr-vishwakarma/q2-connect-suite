import { useEffect, useState } from 'react';
import { Check, Sparkles, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { billingService, SaaSPlan } from '@/services/api/billing.service';

interface PricingSectionProps {
  onOpenLead: () => void;
}

const FEATURE_LABELS: Record<string, string> = {
  ATTENDANCE: 'Digital Roll Call & Attendance',
  COMPLAINTS: 'Complaint & Maintenance Ticket Tracker',
  NOTICES: 'Notice Board & Announcements',
  VISITOR_MANAGEMENT: 'Visitor & Security Gate Passes',
  FEES_MANAGEMENT: 'Automated Rent & Fee Management',
  PAYMENT_GATEWAY: 'Online UPI & Gateway Payment Collection',
  ANALYTICS: 'Occupancy & Financial Analytics',
  WHATSAPP_ALERTS: 'Automated WhatsApp & Alert Broadcasts',
  AI_ASSISTANT: 'Hosteliq Natural-Language AI Assistant',
  EXPORT_REPORTS: 'CSV / Excel Financial & Student Exports',
  MULTI_BRANCH: 'Multi-Branch Centralized Operations',
};

export function PricingSection({ onOpenLead }: PricingSectionProps) {
  const [isYearly, setIsYearly] = useState(false);
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPlans = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      const data = await billingService.getPlans(forceRefresh);
      const sorted = [...(data || [])].sort(
        (a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100) || a.priceMonthly - b.priceMonthly
      );
      setPlans(sorted);
    } catch (err: unknown) {
      console.error('Failed to load public plans:', err);
      setError('Unable to load live pricing catalog right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const hasYearlyOptions = plans.some(
    (p) => !p.allowedBillingCycles || p.allowedBillingCycles.includes('YEARLY')
  );
  const hasMonthlyOptions = plans.some(
    (p) => !p.allowedBillingCycles || p.allowedBillingCycles.includes('MONTHLY')
  );

  // Calculate maximum real annual discount if any plan offers yearly savings
  const maxSavingsPct = plans.reduce((best, p) => {
    if (p.priceMonthly > 0 && p.priceYearly > 0 && p.priceYearly < p.priceMonthly * 12) {
      const pct = Math.round((1 - p.priceYearly / (p.priceMonthly * 12)) * 100);
      return pct > best ? pct : best;
    }
    return best;
  }, 0);

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
            Plans configured live by the Hosteliq platform with transparent capacity and billing intervals.
          </p>

          {/* Billing Switcher Toggle */}
          {hasYearlyOptions && hasMonthlyOptions && (
            <div className="flex items-center justify-center gap-3 mt-8">
              <span className={`text-xs font-semibold ${!isYearly ? 'text-slate-900' : 'text-slate-500'}`}>
                Monthly Billing
              </span>
              <button
                type="button"
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
                {maxSavingsPct > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-extrabold text-[10px]">
                    Save up to {maxSavingsPct}%
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            <span className="text-sm font-medium">Loading live pricing catalog...</span>
          </div>
        ) : error ? (
          <div className="max-w-lg mx-auto text-center py-12 px-6 rounded-2xl border border-slate-200 bg-[#F8F9FC] space-y-4">
            <p className="text-sm font-medium text-slate-700">{error}</p>
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" onClick={() => loadPlans(true)}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
              </Button>
              <Button size="sm" onClick={onOpenLead} className="bg-slate-900 text-white hover:bg-slate-800">
                Connect With Us <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </div>
        ) : plans.length === 0 ? (
          <div className="max-w-lg mx-auto text-center py-12 px-6 rounded-2xl border border-slate-200 bg-[#F8F9FC] space-y-4">
            <p className="text-sm font-medium text-slate-700">
              Custom onboarding plans are available directly through our solutions team.
            </p>
            <Button onClick={onOpenLead} className="bg-slate-900 text-white hover:bg-slate-800">
              Request Custom Quote <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {plans.map((plan) => {
              const allowedCycles = plan.allowedBillingCycles || ['MONTHLY', 'YEARLY'];
              const cycle = isYearly && allowedCycles.includes('YEARLY')
                ? 'YEARLY'
                : !isYearly && allowedCycles.includes('MONTHLY')
                ? 'MONTHLY'
                : allowedCycles[0] || 'MONTHLY';
              const isShowingYearly = cycle === 'YEARLY';
              const price = isShowingYearly ? plan.priceYearly : plan.priceMonthly;
              const maxStudents = plan.limits?.maxStudents ?? 0;
              const maxHostels = plan.limits?.maxHostels ?? 0;
              const isPopular = Boolean(plan.isPopular || plan.badgeText);

              const capacityItems = [
                maxStudents > 0 ? `Up to ${maxStudents} Student Residents` : 'Unlimited Student Residents',
                maxHostels > 0 ? `Up to ${maxHostels} Hostel Branch${maxHostels > 1 ? 'es' : ''}` : 'Unlimited Hostel Branches',
              ];
              const featureItems = (plan.includedFeatures || []).map(
                (key) => FEATURE_LABELS[key] || key.replace(/_/g, ' ')
              );
              const allItems = [...capacityItems, ...featureItems];

              return (
                <div
                  key={plan._id}
                  className={`p-7 sm:p-8 rounded-3xl border flex flex-col justify-between transition-all duration-200 text-left relative ${
                    isPopular
                      ? 'bg-gradient-to-b from-purple-50/50 via-white to-slate-50 border-purple-300 shadow-xl ring-2 ring-purple-600/10'
                      : 'bg-[#F8F9FC] border-slate-200/90 hover:border-slate-300 shadow-sm'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-purple-600 text-white font-bold text-[10px] tracking-wider uppercase shadow-sm">
                      {plan.badgeText || 'Most Popular Choice'}
                    </div>
                  )}

                  <div>
                    <div className="mb-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h3 className="text-xl font-extrabold text-slate-900">{plan.name}</h3>
                        {plan.trialEligible !== false && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            {plan.trialDays || 14}-Day Trial
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 min-h-[32px]">
                        {plan.description || 'Complete multi-branch hostel management capability'}
                      </p>
                    </div>

                    {/* Price display */}
                    <div className="flex items-baseline gap-1.5 my-6 pb-6 border-b border-slate-200/80 flex-wrap">
                      <span className="text-4xl font-black text-slate-900">
                        ₹{(price ?? 0).toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-slate-500 font-semibold">
                        / {isShowingYearly ? 'year' : 'month'}
                      </span>
                      {allowedCycles.length === 1 && (
                        <span className="text-[11px] text-purple-700 font-medium ml-1">
                          ({isShowingYearly ? 'Annual only' : 'Monthly only'})
                        </span>
                      )}
                    </div>

                    {/* Features List */}
                    <div className="space-y-3 mb-8">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                        Included Capabilities:
                      </span>
                      {allItems.map((feat, i) => (
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
                      isPopular
                        ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                  >
                    <span>
                      {plan.trialEligible !== false
                        ? `Start ${plan.trialDays || 14}-Day Trial`
                        : `Choose ${plan.name}`}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
