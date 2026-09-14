import { useState, useEffect, useCallback } from 'react';
import {
  billingService,
  SaaSPlan,
  OrganizationSubscription,
  BillingHistoryInvoice,
  BillingHistoryPayment,
} from '@/services/api/billing.service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  Zap,
  Building2,
  Users,
  DoorOpen,
  Calendar,
  Loader2,
  IndianRupee,
  FileText,
  Download,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'react-toastify';
import { openRazorpaySubscriptionCheckout } from '@/utils/razorpay';
import { useAuth } from '@/hooks/useAuth';

export default function Billing() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [subscription, setSubscription] = useState<OrganizationSubscription | null>(null);
  const [invoices, setInvoices] = useState<BillingHistoryInvoice[]>([]);
  const [payments, setPayments] = useState<BillingHistoryPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');

  // Checkout Confirmation Modal State
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<SaaSPlan | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [plansData, subData, historyData] = await Promise.all([
        billingService.getPlans(),
        billingService.getSubscription(),
        billingService.getBillingHistory(),
      ]);

      setPlans(plansData);
      setSubscription(subData);
      setInvoices(historyData.invoices);
      setPayments(historyData.payments);
    } catch (err: any) {
      console.error('Error fetching billing data:', err);
      toast.error(err.message || 'Failed to load organization billing details');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open Plan Summary / Billing Confirmation Modal
  const handleSelectPlan = (plan: SaaSPlan) => {
    setSelectedPlanForCheckout(plan);
    setIsCheckoutOpen(true);
  };

  // Launch Razorpay Subscription Checkout
  const handleProceedToPayment = async () => {
    if (!selectedPlanForCheckout) return;

    try {
      setIsProcessingCheckout(true);
      const checkoutInit = await billingService.createSubscription(
        selectedPlanForCheckout._id,
        billingCycle
      );

      setIsCheckoutOpen(false);

      await openRazorpaySubscriptionCheckout(
        {
          subscriptionId: checkoutInit.subscriptionId,
          keyId: checkoutInit.keyId,
          amountPaise: checkoutInit.amountPaise,
          currency: checkoutInit.currency,
          organizationName: user?.username || 'Q2 Organization',
          adminEmail: user?.email,
          description: `Subscription for ${checkoutInit.planName} (${checkoutInit.billingCycle})`,
        },
        async (response) => {
          // Signature received from modal -> verify with backend
          try {
            const verifyResult = await billingService.verifySubscription(response);
            toast.success(`Subscription activated! Invoice: ${verifyResult.invoiceNumber}`);
            fetchData();
          } catch (verifyErr: any) {
            console.error('Verification error:', verifyErr);
            toast.error(verifyErr.response?.data?.message || 'Payment received; verifying subscription with provider...');
            fetchData();
          }
        },
        (error) => {
          console.warn('Checkout cancelled or failed:', error);
          toast.info('Checkout was cancelled');
        }
      );
    } catch (err: any) {
      console.error('Subscription creation error:', err);
      toast.error(err.message || 'Failed to initialize subscription checkout');
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">Active</Badge>;
      case 'TRIAL':
        return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">Free Trial</Badge>;
      case 'AUTHENTICATED':
        return <Badge className="bg-purple-500/20 text-purple-500 border-purple-500/30">Authenticated</Badge>;
      case 'PENDING':
        return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">Pending Renewal</Badge>;
      case 'PAST_DUE':
      case 'HALTED':
        return <Badge variant="destructive">Payment Due</Badge>;
      case 'CANCELLED':
        return <Badge variant="outline" className="text-muted-foreground">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading organization billing details...</p>
        </div>
      </div>
    );
  }

  const currentPlan = subscription?.planId;
  const isCurrentPlanActive = subscription?.status === 'ACTIVE' || subscription?.status === 'TRIAL';

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* 1. Top Section: Current Subscription Status Card */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-foreground">
                    Current SaaS Subscription
                  </CardTitle>
                  <CardDescription>
                    Manage your organization's subscription tier, billing period, and capacity limits.
                  </CardDescription>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {subscription && getStatusBadge(subscription.status)}
              <Badge variant="outline" className="font-mono text-xs uppercase">
                {subscription?.billingCycle || 'MONTHLY'}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-secondary/30 border border-border/80">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Active Plan</p>
              <p className="text-lg font-bold text-foreground mt-0.5">{currentPlan?.name || 'Starter Plan'}</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">Code: {currentPlan?.code || 'STARTER'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Recurring Amount</p>
              <p className="text-lg font-bold text-foreground mt-0.5 flex items-center">
                <IndianRupee className="w-4 h-4 mr-0.5 inline text-primary" />
                {(subscription?.amount || currentPlan?.priceMonthly || 0).toLocaleString('en-IN')}
                <span className="text-xs text-muted-foreground font-normal ml-1">
                  / {subscription?.billingCycle?.toLowerCase() === 'yearly' ? 'year' : 'month'}
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Automated Razorpay recurring</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Current Period End</p>
              <p className="text-lg font-bold text-foreground mt-0.5">
                {subscription?.currentPeriodEnd ? format(parseISO(subscription.currentPeriodEnd), 'dd MMM yyyy') : 'N/A'}
              </p>
              <p className="text-xs text-emerald-500 mt-0.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 inline" /> Renews automatically
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Provider Reference</p>
              <p className="text-xs font-mono font-medium text-foreground mt-1 truncate">
                {subscription?.razorpaySubscriptionId || 'N/A (Trial Mode)'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Tokenized gateway agreement</p>
            </div>
          </div>

          {/* Entitlement limits meter */}
          {currentPlan?.limits && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-border/80">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="w-4 h-4 text-primary shrink-0" />
                <span>Max Students: <strong className="text-foreground">{currentPlan.limits.maxStudents}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <DoorOpen className="w-4 h-4 text-primary shrink-0" />
                <span>Max Rooms: <strong className="text-foreground">{currentPlan.limits.maxRooms}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Building2 className="w-4 h-4 text-primary shrink-0" />
                <span>Max Hostels: <strong className="text-foreground">{currentPlan.limits.maxHostels}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Zap className="w-4 h-4 text-primary shrink-0" />
                <span>Storage: <strong className="text-foreground">{currentPlan.limits.storageGb} GB</strong></span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Middle Section: Available Plans Catalog */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Available Q2 SaaS Subscription Plans
            </h2>
            <p className="text-sm text-muted-foreground">
              Select a tier matching your hostel chain capacity. Upgrade or adjust anytime.
            </p>
          </div>

          {/* Monthly / Yearly Billing Toggle */}
          <div className="flex items-center bg-secondary/50 p-1 rounded-xl border border-border shrink-0 self-start sm:self-auto">
            <button
              type="button"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                billingCycle === 'MONTHLY'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setBillingCycle('MONTHLY')}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                billingCycle === 'YEARLY'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setBillingCycle('YEARLY')}
            >
              Yearly Billing
              <span className="bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                Save 15%
              </span>
            </button>
          </div>
        </div>

        {/* Plan Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {plans.map((plan) => {
            const isSelectedPlan = subscription?.planId?._id === plan._id;
            const price = billingCycle === 'YEARLY' ? plan.priceYearly : plan.priceMonthly;

            return (
              <Card
                key={plan._id}
                className={`relative flex flex-col justify-between transition-all duration-200 border-border ${
                  plan.isPopular ? 'border-primary shadow-lg ring-1 ring-primary/30' : 'hover:border-primary/50'
                }`}
              >
                {plan.isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-extrabold uppercase px-3 py-0.5 rounded-full tracking-wider shadow-sm">
                    Most Popular
                  </div>
                )}
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl font-bold text-foreground">{plan.name}</CardTitle>
                      <CardDescription className="text-xs mt-1">{plan.description}</CardDescription>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex items-baseline">
                      <span className="text-3xl font-extrabold text-foreground font-mono flex items-center">
                        <IndianRupee className="w-5 h-5 mr-0.5 inline text-primary" />
                        {price.toLocaleString('en-IN')}
                      </span>
                      <span className="text-muted-foreground text-xs ml-1.5">
                        / {billingCycle === 'YEARLY' ? 'year' : 'month'}
                      </span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 flex-1">
                  <div className="border-t border-border/80 pt-3 space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="w-4 h-4 text-primary shrink-0" />
                      <span>Up to <strong className="text-foreground">{plan.limits?.maxStudents}</strong> students</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <DoorOpen className="w-4 h-4 text-primary shrink-0" />
                      <span>Up to <strong className="text-foreground">{plan.limits?.maxRooms}</strong> rooms</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 className="w-4 h-4 text-primary shrink-0" />
                      <span>Up to <strong className="text-foreground">{plan.limits?.maxHostels}</strong> hostel property</span>
                    </div>
                  </div>

                  {plan.includedFeatures && plan.includedFeatures.length > 0 && (
                    <div className="border-t border-border/80 pt-3 space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        Features Included
                      </p>
                      {plan.includedFeatures.slice(0, 5).map((feat, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-foreground/90">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span className="truncate capitalize">{feat.replace(/_/g, ' ')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>

                <div className="p-6 pt-0">
                  {isSelectedPlan && isCurrentPlanActive ? (
                    <Button
                      variant="outline"
                      className="w-full border-emerald-500/30 text-emerald-500 bg-emerald-500/10 cursor-default"
                      disabled
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1.5" />
                      Current Active Plan
                    </Button>
                  ) : (
                    <Button
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md"
                      onClick={() => handleSelectPlan(plan)}
                    >
                      <CreditCard className="w-4 h-4 mr-1.5" />
                      Choose {plan.name}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 3. Bottom Section: Billing History & Invoices */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            SaaS Billing Invoices & Payments History
          </CardTitle>
          <CardDescription>
            Official tax invoices and digital receipts generated for your recurring SaaS plan charges.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No billing invoices issued yet. Upon subscription activation, invoices will appear here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Invoice Number</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv._id}>
                      <TableCell className="text-foreground text-sm">
                        {inv.issuedAt ? format(parseISO(inv.issuedAt), 'dd MMM yyyy') : '-'}
                      </TableCell>
                      <TableCell className="text-foreground font-mono text-xs font-semibold">
                        {inv.invoiceNumber}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground uppercase">
                        {inv.invoiceType || 'SAAS_INVOICE'}
                      </TableCell>
                      <TableCell className="text-foreground font-bold font-mono">
                        ₹{inv.totalRupees.toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 text-[11px]">
                          {inv.status || 'PAID'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs font-medium"
                          onClick={() => toast.info(`Invoice ${inv.invoiceNumber} is permanently preserved in ledger`)}
                        >
                          <FileText className="w-3.5 h-3.5 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Plan Summary & Checkout Confirmation Modal */}
      {selectedPlanForCheckout && (
        <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
          <DialogContent className="sm:max-w-[460px] bg-card border-border rounded-2xl p-6 shadow-2xl animate-fade-in">
            <DialogHeader className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-1">
                <CreditCard className="w-6 h-6" />
              </div>
              <DialogTitle className="text-xl font-bold text-foreground">
                Confirm Subscription
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm">
                Review your plan summary before continuing to secure Razorpay subscription checkout.
              </DialogDescription>
            </DialogHeader>

            <div className="bg-secondary/40 border border-border/80 rounded-xl p-4 my-4 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Selected Plan</span>
                <span className="font-semibold text-foreground">{selectedPlanForCheckout.name}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Billing Cycle</span>
                <Badge variant="outline" className="font-mono text-xs">
                  {billingCycle}
                </Badge>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Student Capacity</span>
                <span className="text-foreground">{selectedPlanForCheckout.limits?.maxStudents} students</span>
              </div>
              <div className="border-t border-border pt-3 flex justify-between items-center">
                <span className="font-bold text-foreground">Recurring Charge</span>
                <span className="text-2xl font-extrabold text-primary font-mono flex items-center">
                  <IndianRupee className="w-5 h-5 mr-0.5 inline" />
                  {(billingCycle === 'YEARLY'
                    ? selectedPlanForCheckout.priceYearly
                    : selectedPlanForCheckout.priceMonthly
                  ).toLocaleString('en-IN')}
                  <span className="text-xs text-muted-foreground font-normal ml-1">
                    / {billingCycle === 'YEARLY' ? 'yr' : 'mo'}
                  </span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Recurring agreement secured by 256-bit encryption via Razorpay.</span>
            </div>

            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                disabled={isProcessingCheckout}
                onClick={() => setIsCheckoutOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                disabled={isProcessingCheckout}
                onClick={handleProceedToPayment}
              >
                {isProcessingCheckout ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Initializing Gateway...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 mr-2" />
                    Continue to Secure Payment
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
