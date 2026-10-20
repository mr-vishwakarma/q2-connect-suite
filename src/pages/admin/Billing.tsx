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
  Ticket,
  Tag,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format, parseISO } from 'date-fns';
import { toast } from 'react-toastify';
import {
  openRazorpaySubscriptionCheckout,
  openRazorpayOrderCheckout,
} from '@/utils/razorpay';
import { voucherService, ApplyVoucherResponse } from '@/services/api/voucher.service';
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

  // Voucher State for Checkout
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherPin, setVoucherPin] = useState('');
  const [isPinVisible, setIsPinVisible] = useState(false);
  const [isApplyingVoucher, setIsApplyingVoucher] = useState(false);
  const [appliedVoucherPreview, setAppliedVoucherPreview] = useState<ApplyVoucherResponse | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);

  const resetVoucherState = () => {
    setVoucherCode('');
    setVoucherPin('');
    setAppliedVoucherPreview(null);
    setVoucherError(null);
    setIsPinVisible(false);
  };

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
    resetVoucherState();
    setIsCheckoutOpen(true);
  };

  // 1. Preview Voucher
  const handleApplyVoucher = async () => {
    if (!selectedPlanForCheckout) return;
    if (!voucherCode.trim()) {
      setVoucherError('Please enter your 16-character voucher code');
      return;
    }
    if (!voucherPin.trim()) {
      setVoucherError('Please enter your 6-digit secret PIN');
      return;
    }

    try {
      setIsApplyingVoucher(true);
      setVoucherError(null);
      const preview = await voucherService.applyVoucher({
        code: voucherCode.trim(),
        pin: voucherPin.trim(),
        planId: selectedPlanForCheckout._id,
        billingCycle,
      });
      setAppliedVoucherPreview(preview);
      toast.success(`Voucher applied! ₹${preview.discountAmount.toLocaleString('en-IN')} discount calculated.`);
    } catch (err: any) {
      console.error('Apply voucher error:', err);
      const msg = err.response?.data?.message || err.message || 'Voucher could not be applied';
      setVoucherError(msg);
      setAppliedVoucherPreview(null);
      toast.error(msg);
    } finally {
      setIsApplyingVoucher(false);
    }
  };

  // 2. Zero-Payable Direct Activation (Atomic ₹0)
  const handleRedeemZeroPayable = async () => {
    if (!selectedPlanForCheckout || !appliedVoucherPreview) return;
    try {
      setIsProcessingCheckout(true);
      const result = await voucherService.redeemZeroPayable({
        code: voucherCode.trim(),
        pin: voucherPin.trim(),
        planId: selectedPlanForCheckout._id,
        billingCycle,
        idempotencyKey: `zero_${selectedPlanForCheckout._id}_${Date.now()}`,
      });
      toast.success(`Subscription activated with voucher! Invoice: ${result.invoiceNumber}`);
      setIsCheckoutOpen(false);
      resetVoucherState();
      fetchData();
    } catch (err: any) {
      console.error('Zero-payable redemption error:', err);
      toast.error(err.response?.data?.message || err.message || 'Failed to activate subscription with voucher');
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  // 3. Partial-Discount Payment Checkout
  const handleProceedWithPartialDiscount = async () => {
    if (!selectedPlanForCheckout || !appliedVoucherPreview) return;
    try {
      setIsProcessingCheckout(true);
      const reservation = await voucherService.reservePartial({
        code: voucherCode.trim(),
        pin: voucherPin.trim(),
        planId: selectedPlanForCheckout._id,
        billingCycle,
      });

      setIsCheckoutOpen(false);

      await openRazorpayOrderCheckout(
        {
          orderId: reservation.orderId,
          keyId: reservation.keyId,
          amountPaise: reservation.amountPaise,
          currency: reservation.currency,
          organizationName: user?.username || 'Q2 Organization',
          adminEmail: user?.email,
          description: `Discounted Subscription for ${reservation.planName} (${reservation.billingCycle})`,
        },
        async (response) => {
          try {
            const verifyResult = await voucherService.verifyPartial({
              checkoutSessionId: reservation.checkoutSessionId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success(`Discounted subscription activated! Invoice: ${verifyResult.invoiceNumber}`);
            resetVoucherState();
            fetchData();
          } catch (verifyErr: any) {
            console.error('Partial discount verification error:', verifyErr);
            toast.error(verifyErr.response?.data?.message || 'Payment received; verifying with provider...');
            fetchData();
          }
        },
        (error) => {
          console.warn('Checkout cancelled:', error);
          toast.info('Checkout was cancelled');
        }
      );
    } catch (err: any) {
      console.error('Partial reservation error:', err);
      toast.error(err.response?.data?.message || err.message || 'Failed to initiate discounted payment');
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  // 4. Standard Non-Voucher Razorpay One-Time Payment Checkout (Manual Renewal)
  const handleProceedToPayment = async () => {
    if (!selectedPlanForCheckout) return;

    try {
      setIsProcessingCheckout(true);
      const checkoutInit = await billingService.createSubscription(
        selectedPlanForCheckout._id,
        billingCycle
      );

      setIsCheckoutOpen(false);

      await openRazorpayOrderCheckout(
        {
          orderId: checkoutInit.orderId || checkoutInit.subscriptionId || '',
          keyId: checkoutInit.keyId,
          amountPaise: checkoutInit.amountPaise,
          currency: checkoutInit.currency,
          organizationName: user?.username || 'Q2 Organization',
          adminEmail: user?.email,
          description: `SaaS Manual Plan Renewal - ${checkoutInit.planName} (${checkoutInit.billingCycle})`,
        },
        async (response) => {
          try {
            const verifyResult = await billingService.verifySubscription({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success(`Subscription renewed successfully! Invoice: ${verifyResult.invoiceNumber}`);
            fetchData();
          } catch (verifyErr: any) {
            console.error('Verification error:', verifyErr);
            toast.error(verifyErr.response?.data?.message || 'Payment received; verifying with provider...');
            fetchData();
          }
        },
        (error) => {
          console.warn('Checkout cancelled or failed:', error);
          toast.info('Checkout was cancelled');
        }
      );
    } catch (err: any) {
      console.error('Checkout creation error:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to initialize payment checkout';
      toast.error(msg);
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
      case 'EXPIRED':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Expired</Badge>;
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
      {/* Expired Plan Banner */}
      {subscription?.status === 'EXPIRED' && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-destructive font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Your subscription period has ended. Please renew manually or apply an eligible voucher. All your hostel, room, and student records are safely preserved.
            </span>
          </div>
          {currentPlan && (
            <Button
              size="sm"
              variant="destructive"
              className="h-8 text-xs font-semibold shrink-0"
              onClick={() => handleSelectPlan(currentPlan)}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Renew Plan Now
            </Button>
          )}
        </div>
      )}

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
                    Manage your organization's subscription tier, manual renewal period, and payment history.
                  </CardDescription>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {currentPlan && (
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm text-xs h-8"
                  onClick={() => handleSelectPlan(currentPlan)}
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Renew Plan
                </Button>
              )}
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
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Plan Price</p>
              <p className="text-lg font-bold text-foreground mt-0.5 flex items-center">
                <IndianRupee className="w-4 h-4 mr-0.5 inline text-primary" />
                {(subscription?.amount || currentPlan?.priceMonthly || 0).toLocaleString('en-IN')}
                <span className="text-xs text-muted-foreground font-normal ml-1">
                  / {subscription?.billingCycle?.toLowerCase() === 'yearly' ? 'year' : 'month'}
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Manual renewal flow</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Current Period End</p>
              <p className="text-lg font-bold text-foreground mt-0.5">
                {subscription?.currentPeriodEnd ? format(parseISO(subscription.currentPeriodEnd), 'dd MMM yyyy') : 'N/A'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 inline text-primary" /> Manual renewal; automatic renewal is off
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Renewal Mode</p>
              <p className="text-lg font-bold text-foreground mt-0.5">Manual Renewal</p>
              <p className="text-xs text-muted-foreground mt-0.5">Automatic deduction is off</p>
            </div>
          </div>
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
                  {plan.includedFeatures && plan.includedFeatures.length > 0 && (
                    <div className="border-t border-border/80 pt-3 space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        Features Included
                      </p>
                      {plan.includedFeatures.slice(0, 6).map((feat, idx) => (
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
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 border-emerald-500/30 text-emerald-500 bg-emerald-500/10 cursor-default text-xs"
                        disabled
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1.5" />
                        Current Plan
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-primary/40 text-primary hover:bg-primary/10 text-xs font-semibold px-3"
                        onClick={() => handleSelectPlan(plan)}
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        Renew
                      </Button>
                    </div>
                  ) : (
                    <Button
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md text-xs"
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
          <DialogContent className="sm:max-w-[500px] bg-card border-border rounded-2xl p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <DialogHeader className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-1">
                <CreditCard className="w-6 h-6" />
              </div>
              <DialogTitle className="text-xl font-bold text-foreground">
                Confirm Subscription
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Review your plan selection, apply subscription vouchers, and activate your tier.
              </DialogDescription>
            </DialogHeader>

            {/* Plan Specs */}
            <div className="bg-secondary/40 border border-border/80 rounded-xl p-4 my-3 space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Selected Plan</span>
                <span className="font-semibold text-foreground">{selectedPlanForCheckout.name}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Billing Cycle</span>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {billingCycle}
                </Badge>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Renewal Mode</span>
                <span className="text-foreground font-medium">Manual Renewal (One-Time)</span>
              </div>
            </div>

            {/* Voucher Redemption Section */}
            <div className="border border-border/80 rounded-xl p-4 bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Ticket className="w-4 h-4 text-primary" />
                  <span>Subscription Voucher / Coupon</span>
                </div>
                {appliedVoucherPreview && (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                    Discount Applied
                  </Badge>
                )}
              </div>

              {!appliedVoucherPreview ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground font-medium">
                        16-Char Voucher Code
                      </Label>
                      <Input
                        id="voucher-code-input"
                        placeholder="e.g. Q2M7K9X4P8W3R6TZ"
                        value={voucherCode}
                        onChange={(e) => {
                          setVoucherCode(e.target.value.toUpperCase());
                          setVoucherError(null);
                        }}
                        className="h-8 text-xs font-mono uppercase"
                        maxLength={19}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground font-medium">
                        6-Digit Secret PIN
                      </Label>
                      <div className="relative">
                        <Input
                          id="voucher-pin-input"
                          type={isPinVisible ? 'text' : 'password'}
                          placeholder="6-digit PIN"
                          value={voucherPin}
                          onChange={(e) => {
                            setVoucherPin(e.target.value);
                            setVoucherError(null);
                          }}
                          className="h-8 text-xs font-mono tracking-wider pr-8"
                          maxLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setIsPinVisible(!isPinVisible)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          tabIndex={-1}
                        >
                          {isPinVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {voucherError && (
                    <p className="text-[11px] text-destructive flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {voucherError}
                    </p>
                  )}

                  <Button
                    id="apply-voucher-btn"
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={handleApplyVoucher}
                    disabled={isApplyingVoucher || !voucherCode.trim() || !voucherPin.trim()}
                    className="w-full h-8 text-xs font-semibold"
                  >
                    {isApplyingVoucher ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Validating Voucher...
                      </>
                    ) : (
                      <>
                        <Tag className="w-3.5 h-3.5 mr-1.5" /> Apply Voucher
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
                    <div>
                      <p className="font-bold text-emerald-400">{appliedVoucherPreview.voucherName}</p>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {appliedVoucherPreview.voucherReference}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-400 text-sm">
                        -₹{appliedVoucherPreview.discountAmount.toLocaleString('en-IN')}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={resetVoucherState}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                        title="Remove voucher"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Financial Summary Calculation */}
            <div className="bg-secondary/30 border border-border rounded-xl p-4 my-2 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Original Plan Price</span>
                <span className="font-semibold text-foreground">
                  ₹{(billingCycle === 'YEARLY'
                    ? selectedPlanForCheckout.priceYearly
                    : selectedPlanForCheckout.priceMonthly
                  ).toLocaleString('en-IN')}
                </span>
              </div>

              {appliedVoucherPreview && (
                <div className="flex justify-between items-center text-xs text-emerald-400">
                  <span className="font-medium flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Voucher Discount
                  </span>
                  <span className="font-bold">
                    -₹{appliedVoucherPreview.discountAmount.toLocaleString('en-IN')}
                  </span>
                </div>
              )}

              <div className="border-t border-border pt-2 flex justify-between items-center">
                <span className="font-bold text-sm text-foreground">Final Payable</span>
                <div className="text-right">
                  <span className="text-2xl font-extrabold text-primary font-mono flex items-center justify-end">
                    <IndianRupee className="w-5 h-5 mr-0.5 inline" />
                    {(appliedVoucherPreview
                      ? appliedVoucherPreview.finalPayable
                      : billingCycle === 'YEARLY'
                      ? selectedPlanForCheckout.priceYearly
                      : selectedPlanForCheckout.priceMonthly
                    ).toLocaleString('en-IN')}
                    <span className="text-xs text-muted-foreground font-normal ml-1">
                      / {billingCycle === 'YEARLY' ? 'yr' : 'mo'}
                    </span>
                  </span>

                  {appliedVoucherPreview?.isZeroPayable && (
                    <span className="text-[11px] font-bold text-emerald-400 block mt-0.5">
                      100% Free • Zero-Balance Activation
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-4">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>
                {appliedVoucherPreview?.isZeroPayable
                  ? 'Zero-balance voucher entitlement processed securely without gateway redirect.'
                  : 'One-time payment secured by 256-bit encryption via Razorpay.'}
              </span>
            </div>

            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button
                variant="outline"
                className="w-full sm:w-auto text-xs"
                disabled={isProcessingCheckout}
                onClick={() => setIsCheckoutOpen(false)}
              >
                Cancel
              </Button>

              {appliedVoucherPreview?.isZeroPayable ? (
                <Button
                  id="proceed-zero-payable-btn"
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md text-xs"
                  disabled={isProcessingCheckout}
                  onClick={handleRedeemZeroPayable}
                >
                  {isProcessingCheckout ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Activating Subscription...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Proceed & Activate (₹0 Free)
                    </>
                  )}
                </Button>
              ) : appliedVoucherPreview ? (
                <Button
                  id="proceed-partial-discount-btn"
                  className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs"
                  disabled={isProcessingCheckout}
                  onClick={handleProceedWithPartialDiscount}
                >
                  {isProcessingCheckout ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Initializing Gateway...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Pay ₹{appliedVoucherPreview.finalPayable.toLocaleString('en-IN')} via Razorpay
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  id="proceed-standard-payment-btn"
                  className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs"
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
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
