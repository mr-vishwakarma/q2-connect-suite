import { useState, useEffect, useCallback } from 'react';
import {
  billingService,
  SaaSPlan,
  OrganizationSubscription,
  BillingHistoryInvoice,
  BillingHistoryPayment,
  BillingHistoryLifecycleItem,
  UpgradeQuoteResponse,
  DowngradeRequestResponse,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  Loader2,
  IndianRupee,
  FileText,
  AlertTriangle,
  RotateCcw,
  Ticket,
  Tag,
  Eye,
  EyeOff,
  X,
  ArrowUpRight,
  ArrowDownRight,
  History,
  Ban,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format, parseISO } from 'date-fns';
import { toast } from 'react-toastify';
import { openRazorpayOrderCheckout } from '@/utils/razorpay';
import { voucherService, ApplyVoucherResponse } from '@/services/api/voucher.service';
import { useAuth } from '@/hooks/useAuth';
import { getErrorMessage } from '@/utils/errorHandling';

export default function Billing() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [subscription, setSubscription] = useState<OrganizationSubscription | null>(null);
  const [subError, setSubError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<BillingHistoryInvoice[]>([]);
  const [payments, setPayments] = useState<BillingHistoryPayment[]>([]);
  const [lifecycleHistory, setLifecycleHistory] = useState<BillingHistoryLifecycleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [cycleInitialized, setCycleInitialized] = useState(false);

  // Standard / Activation / Renewal / Voucher Checkout Modal
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<SaaSPlan | null>(null);
  const [checkoutCycle, setCheckoutCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [checkoutIntent, setCheckoutIntent] = useState<'ACTIVATION' | 'RENEWAL' | 'UPGRADE' | 'REACTIVATION'>('ACTIVATION');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

  // Voucher State inside Checkout Modal
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherPin, setVoucherPin] = useState('');
  const [isPinVisible, setIsPinVisible] = useState(false);
  const [isApplyingVoucher, setIsApplyingVoucher] = useState(false);
  const [appliedVoucherPreview, setAppliedVoucherPreview] = useState<ApplyVoucherResponse | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);

  // Upgrade Quote & Proration Modal
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeQuote, setUpgradeQuote] = useState<UpgradeQuoteResponse | null>(null);
  const [isProcessingUpgrade, setIsProcessingUpgrade] = useState(false);

  // Downgrade Confirmation Modal
  const [downgradeModalOpen, setDowngradeModalOpen] = useState(false);
  const [downgradeLoading, setDowngradeLoading] = useState(false);
  const [downgradeInfo, setDowngradeInfo] = useState<{
    plan: SaaSPlan;
    cycle: 'MONTHLY' | 'YEARLY';
    quote: DowngradeRequestResponse;
  } | null>(null);
  const [isCancellingDowngrade, setIsCancellingDowngrade] = useState(false);
  const [isStartingTrial, setIsStartingTrial] = useState<string | null>(null);

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
      setSubError(null);

      const [plansRes, subRes, historyRes] = await Promise.allSettled([
        billingService.getPlans(true),
        billingService.getSubscription(),
        billingService.getBillingHistory(),
      ]);

      if (plansRes.status === 'fulfilled') {
        const sortedPlans = [...(plansRes.value || [])].sort(
          (a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100) || a.priceMonthly - b.priceMonthly
        );
        setPlans(sortedPlans);
      }

      if (subRes.status === 'fulfilled') {
        const subData = subRes.value;
        setSubscription(subData);
        if (!cycleInitialized && subData) {
          const initialCycle = subData.pricingSnapshot?.billingCycle || subData.billingCycle || 'MONTHLY';
          setBillingCycle(initialCycle === 'YEARLY' ? 'YEARLY' : 'MONTHLY');
          setCycleInitialized(true);
        }
      } else {
        setSubscription(null);
        const reason = (typeof subRes.reason === 'object' && subRes.reason !== null ? subRes.reason : {}) as { response?: { data?: { message?: string } }; message?: string };
        setSubError(
          reason?.response?.data?.message ||
            reason?.message ||
            'No active subscription record found for this organization.'
        );
      }

      if (historyRes.status === 'fulfilled') {
        setInvoices(historyRes.value.invoices || []);
        setPayments(historyRes.value.payments || []);
        setLifecycleHistory(historyRes.value.subscriptionHistory || []);
      }
    } catch (err: unknown) {
      console.error('Error fetching billing data:', err);
      toast.error(getErrorMessage(err, 'Failed to load organization billing details'));
    } finally {
      setLoading(false);
    }
  }, [cycleInitialized]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open Checkout Modal (Activate / Renew / Reactivate / Voucher)
  const openCheckoutModal = (
    plan: SaaSPlan,
    cycle: 'MONTHLY' | 'YEARLY',
    intent: 'ACTIVATION' | 'RENEWAL' | 'UPGRADE' | 'REACTIVATION'
  ) => {
    const allowed = plan.allowedBillingCycles || ['MONTHLY', 'YEARLY'];
    const validCycle = allowed.includes(cycle) ? cycle : allowed[0] || 'MONTHLY';
    setSelectedPlanForCheckout(plan);
    setCheckoutCycle(validCycle);
    setCheckoutIntent(intent);
    resetVoucherState();
    setIsCheckoutOpen(true);
  };

  // Start Free Trial directly (when eligible)
  const handleStartTrial = async (plan: SaaSPlan, cycle: 'MONTHLY' | 'YEARLY') => {
    const allowed = plan.allowedBillingCycles || ['MONTHLY', 'YEARLY'];
    const validCycle = allowed.includes(cycle) ? cycle : allowed[0] || 'MONTHLY';
    try {
      setIsStartingTrial(plan._id);
      await billingService.startTrial({
        planId: plan._id,
        billingCycle: validCycle,
        trialDays: plan.trialDays || 14,
      });
      toast.success(`${plan.trialDays || 14}-day free trial activated on ${plan.name}!`);
      fetchData();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to start free trial'));
    } finally {
      setIsStartingTrial(null);
    }
  };

  // Preview Server Upgrade Quote
  const handleOpenUpgrade = async (plan: SaaSPlan, cycle: 'MONTHLY' | 'YEARLY') => {
    const allowed = plan.allowedBillingCycles || ['MONTHLY', 'YEARLY'];
    const validCycle = allowed.includes(cycle) ? cycle : allowed[0] || 'MONTHLY';
    try {
      setUpgradeModalOpen(true);
      setUpgradeLoading(true);
      setUpgradeQuote(null);
      const quote = await billingService.previewUpgrade({
        targetPlanId: plan._id,
        billingCycle: validCycle,
      });
      setUpgradeQuote(quote);
    } catch (err: unknown) {
      setUpgradeModalOpen(false);
      toast.error(getErrorMessage(err, 'Unable to preview plan upgrade'));
    } finally {
      setUpgradeLoading(false);
    }
  };

  // Confirm Upgrade Payment via Razorpay
  const handleConfirmUpgradePayment = async () => {
    if (!upgradeQuote?.targetPlan?._id) return;
    const targetPlan = upgradeQuote.targetPlan;
    const targetCycle = upgradeQuote.billingCycle;

    try {
      setIsProcessingUpgrade(true);
      const checkoutInit = await billingService.createSubscription(
        targetPlan._id,
        targetCycle,
        'UPGRADE'
      );

      setUpgradeModalOpen(false);

      await openRazorpayOrderCheckout(
        {
          orderId: checkoutInit.orderId || checkoutInit.subscriptionId || '',
          keyId: checkoutInit.keyId,
          amountPaise: checkoutInit.amountPaise,
          currency: checkoutInit.currency,
          organizationName: user?.username || 'Hosteliq Organization',
          adminEmail: user?.email,
          description: `Plan Upgrade to ${checkoutInit.planName} (${checkoutInit.billingCycle})`,
        },
        async (response) => {
          try {
            const verifyResult = await billingService.verifySubscription({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success(`Upgraded to ${targetPlan.name}! Invoice: ${verifyResult.invoiceNumber}`);
            fetchData();
          } catch (verifyErr: unknown) {
            toast.error(getErrorMessage(verifyErr, 'Payment verification pending...'));
            fetchData();
          }
        },
        async (error) => {
          const reason = error?.description || error?.message || 'Upgrade payment cancelled or failed';
          try {
            await billingService.recordPaymentFailed({
              orderId: checkoutInit.orderId,
              code: error?.code,
              reason,
            });
          } catch {
            // ignore
          }
          toast.error(reason);
          fetchData();
        }
      );
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to initiate upgrade payment'));
    } finally {
      setIsProcessingUpgrade(false);
    }
  };

  // Request Next-Cycle Downgrade Quote / Capacity Warning Check
  const handleOpenDowngrade = async (plan: SaaSPlan, cycle: 'MONTHLY' | 'YEARLY') => {
    const allowed = plan.allowedBillingCycles || ['MONTHLY', 'YEARLY'];
    const validCycle = allowed.includes(cycle) ? cycle : allowed[0] || 'MONTHLY';
    try {
      setDowngradeLoading(true);
      const result = await billingService.requestDowngrade({
        targetPlanId: plan._id,
        billingCycle: validCycle,
        confirmOverCapacity: false,
      });

      if (result.scheduled) {
        toast.success(
          `Downgrade to ${plan.name} scheduled for ${
            result.effectiveDate ? format(parseISO(result.effectiveDate), 'dd MMM yyyy') : 'next renewal'
          }`
        );
        fetchData();
        return;
      }

      if (result.requiresConfirmation) {
        setDowngradeInfo({ plan, cycle: validCycle, quote: result });
        setDowngradeModalOpen(true);
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Unable to schedule plan downgrade'));
    } finally {
      setDowngradeLoading(false);
    }
  };

  const handleConfirmOverCapacityDowngrade = async () => {
    if (!downgradeInfo) return;
    try {
      setDowngradeLoading(true);
      const result = await billingService.requestDowngrade({
        targetPlanId: downgradeInfo.plan._id,
        billingCycle: downgradeInfo.cycle,
        confirmOverCapacity: true,
      });
      if (result.scheduled) {
        toast.success(`Downgrade to ${downgradeInfo.plan.name} scheduled for next renewal cycle.`);
        setDowngradeModalOpen(false);
        setDowngradeInfo(null);
        fetchData();
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to confirm downgrade'));
    } finally {
      setDowngradeLoading(false);
    }
  };

  const handleCancelScheduledDowngrade = async () => {
    try {
      setIsCancellingDowngrade(true);
      await billingService.cancelScheduledDowngrade();
      toast.success('Scheduled plan change cancelled.');
      fetchData();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to cancel scheduled downgrade'));
    } finally {
      setIsCancellingDowngrade(false);
    }
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
        billingCycle: checkoutCycle,
      });
      setAppliedVoucherPreview(preview);
      toast.success(
        preview.benefitSummary ||
          `Voucher applied! ₹${preview.discountAmount.toLocaleString('en-IN')} benefit calculated.`
      );
    } catch (err: unknown) {
      console.error('Apply voucher error:', err);
      const msg = getErrorMessage(err, 'Voucher could not be applied');
      setVoucherError(msg);
      setAppliedVoucherPreview(null);
      toast.error(msg);
    } finally {
      setIsApplyingVoucher(false);
    }
  };

  // 2. Zero-Payable / Activation / Trial Voucher Redemption
  const handleRedeemZeroPayable = async () => {
    if (!selectedPlanForCheckout || !appliedVoucherPreview) return;
    try {
      setIsProcessingCheckout(true);
      const result = await voucherService.redeemZeroPayable({
        code: voucherCode.trim(),
        pin: voucherPin.trim(),
        planId: selectedPlanForCheckout._id,
        billingCycle: checkoutCycle,
        idempotencyKey: `zero_${selectedPlanForCheckout._id}_${Date.now()}`,
      });
      toast.success(
        result.status === 'TRIAL'
          ? `${result.trialDaysGranted || 14}-day voucher trial activated!`
          : `Subscription activated with voucher!${result.invoiceNumber ? ` Invoice: ${result.invoiceNumber}` : ''}`
      );
      setIsCheckoutOpen(false);
      resetVoucherState();
      fetchData();
    } catch (err: unknown) {
      console.error('Zero-payable redemption error:', err);
      toast.error(getErrorMessage(err, 'Failed to redeem voucher'));
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
        billingCycle: checkoutCycle,
      });

      setIsCheckoutOpen(false);

      await openRazorpayOrderCheckout(
        {
          orderId: reservation.orderId,
          keyId: reservation.keyId,
          amountPaise: reservation.amountPaise,
          currency: reservation.currency,
          organizationName: user?.username || 'Hosteliq Organization',
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
          } catch (verifyErr: unknown) {
            console.error('Partial discount verification error:', verifyErr);
            toast.error(getErrorMessage(verifyErr, 'Payment verification failed'));
            fetchData();
          }
        },
        async (error) => {
          const reason = error?.description || error?.message || 'Checkout was cancelled';
          try {
            await billingService.recordPaymentFailed({
              orderId: reservation.orderId,
              code: error?.code,
              reason,
            });
          } catch {
            // ignore
          }
          toast.info(reason);
          fetchData();
        }
      );
    } catch (err: unknown) {
      console.error('Partial reservation error:', err);
      toast.error(getErrorMessage(err, 'Failed to initiate discounted payment'));
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  // 4. Standard Non-Voucher Razorpay Payment Checkout
  const handleProceedToPayment = async () => {
    if (!selectedPlanForCheckout) return;

    try {
      setIsProcessingCheckout(true);
      const checkoutInit = await billingService.createSubscription(
        selectedPlanForCheckout._id,
        checkoutCycle,
        checkoutIntent
      );

      setIsCheckoutOpen(false);

      await openRazorpayOrderCheckout(
        {
          orderId: checkoutInit.orderId || checkoutInit.subscriptionId || '',
          keyId: checkoutInit.keyId,
          amountPaise: checkoutInit.amountPaise,
          currency: checkoutInit.currency,
          organizationName: user?.username || 'Hosteliq Organization',
          adminEmail: user?.email,
          description: `${checkoutIntent} - ${checkoutInit.planName} (${checkoutInit.billingCycle})`,
        },
        async (response) => {
          try {
            const verifyResult = await billingService.verifySubscription({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success(`Payment verified! Invoice: ${verifyResult.invoiceNumber}`);
            fetchData();
          } catch (verifyErr: unknown) {
            console.error('Verification error:', verifyErr);
            toast.error(getErrorMessage(verifyErr, 'Payment verification failed'));
            fetchData();
          }
        },
        async (error) => {
          const reason = error?.description || error?.message || 'Checkout was cancelled or failed';
          try {
            await billingService.recordPaymentFailed({
              orderId: checkoutInit.orderId,
              code: error?.code,
              reason,
            });
          } catch {
            // ignore
          }
          toast.error(reason);
          fetchData();
        }
      );
    } catch (err: unknown) {
      console.error('Checkout creation error:', err);
      const msg = getErrorMessage(err, 'Failed to initialize payment checkout');
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
      case 'PENDING_PAYMENT':
      case 'CREATED':
      case 'PENDING':
        return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">Pending Payment</Badge>;
      case 'PAYMENT_FAILED':
      case 'PAST_DUE':
      case 'HALTED':
        return <Badge variant="destructive">{status === 'PAYMENT_FAILED' ? 'Payment Failed' : 'Payment Due'}</Badge>;
      case 'EXPIRED':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Expired</Badge>;
      case 'CANCELLED':
        return <Badge variant="outline" className="text-muted-foreground">Cancelled</Badge>;
      case 'SUSPENDED':
        return <Badge variant="destructive">Suspended</Badge>;
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
  const snapshot = subscription?.pricingSnapshot;
  const authoritativePlanName = snapshot?.planName || currentPlan?.name || null;
  const authoritativePlanCode = snapshot?.planCode || currentPlan?.code || null;
  const authoritativeCycle = (snapshot?.billingCycle || subscription?.billingCycle || 'MONTHLY') as 'MONTHLY' | 'YEARLY';
  const currentAgreedPrice =
    snapshot?.agreedPriceRupees ??
    subscription?.agreedPriceRupees ??
    subscription?.amount ??
    (authoritativeCycle === 'YEARLY' ? currentPlan?.priceYearly : currentPlan?.priceMonthly) ??
    null;
  const limits = snapshot?.limits || currentPlan?.limits;
  const usage = subscription?.usage;
  const actions = subscription?.availableActions;

  const isTrial = subscription?.status === 'TRIAL';
  const isActivePaid = subscription?.status === 'ACTIVE';
  const isPendingOrFailed =
    subscription?.status === 'PENDING_PAYMENT' ||
    subscription?.status === 'CREATED' ||
    subscription?.status === 'PENDING' ||
    subscription?.status === 'PAYMENT_FAILED';
  const isExpiredOrCancelled = subscription?.status === 'EXPIRED' || subscription?.status === 'CANCELLED';

  const maxSavingsPct = plans.reduce((best, p) => {
    if (p.priceMonthly > 0 && p.priceYearly > 0 && p.priceYearly < p.priceMonthly * 12) {
      const pct = Math.round((1 - p.priceYearly / (p.priceMonthly * 12)) * 100);
      return pct > best ? pct : best;
    }
    return best;
  }, 0);

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Missing Subscription Error Banner (Never fakes Starter!) */}
      {!subscription && subError && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 flex items-start gap-3 text-xs text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Subscription Record Not Found</p>
            <p className="mt-0.5 opacity-90">{subError}</p>
          </div>
        </div>
      )}

      {/* Contextual Status Banners */}
      {isTrial && subscription && (
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5 text-blue-300 font-medium">
            <Clock className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
            <span>
              You are currently on a <strong>Free Trial</strong> of{' '}
              <strong>{authoritativePlanName || 'your assigned plan'}</strong>
              {subscription.trialEndsAt
                ? ` ending on ${format(parseISO(subscription.trialEndsAt), 'dd MMM yyyy')}`
                : ''}
              {subscription.nearExpiry?.daysRemaining !== null && subscription.nearExpiry?.daysRemaining !== undefined
                ? ` (${subscription.nearExpiry.daysRemaining} day(s) remaining)`
                : ''}
              . Activate via online payment or redeem a voucher anytime without losing data.
            </span>
          </div>
          {currentPlan && (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                className="h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white"
                onClick={() => openCheckoutModal(currentPlan, authoritativeCycle, 'ACTIVATION')}
              >
                <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                Activate Plan
              </Button>
            </div>
          )}
        </div>
      )}

      {isPendingOrFailed && subscription && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5 text-amber-200 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <div>
              <span>
                {subscription.status === 'PAYMENT_FAILED'
                  ? 'Your last payment attempt did not complete. '
                  : 'Your subscription is awaiting activation. '}
                Selected plan: <strong>{authoritativePlanName || 'Assigned Plan'}</strong>
                {currentAgreedPrice !== null ? ` (₹${Number(currentAgreedPrice).toLocaleString('en-IN')})` : ''}.
              </span>
              {subscription.lastPayment?.failureReason && (
                <p className="text-[11px] text-amber-300/90 mt-0.5">
                  Gateway note: {subscription.lastPayment.failureReason}
                </p>
              )}
            </div>
          </div>
          {currentPlan && (
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <Button
                size="sm"
                className="h-8 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-black"
                onClick={() => openCheckoutModal(currentPlan, authoritativeCycle, 'ACTIVATION')}
              >
                <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                Complete Activation / Voucher
              </Button>
              {actions?.canStartTrial && currentPlan.trialEligible !== false && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-semibold border-amber-500/40"
                  disabled={isStartingTrial === currentPlan._id}
                  onClick={() => handleStartTrial(currentPlan, authoritativeCycle)}
                >
                  {isStartingTrial === currentPlan._id ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 mr-1" />
                  )}
                  Start {currentPlan.trialDays || 14}-Day Trial
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {isExpiredOrCancelled && subscription && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-destructive font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Your subscription period has ended. Reactivate or apply an eligible voucher to restore full access. All your hostel, room, and student records are safely preserved.
            </span>
          </div>
          {currentPlan && (
            <Button
              size="sm"
              variant="destructive"
              className="h-8 text-xs font-semibold shrink-0"
              onClick={() => openCheckoutModal(currentPlan, authoritativeCycle, 'REACTIVATION')}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Reactivate Plan
            </Button>
          )}
        </div>
      )}

      {isActivePaid && subscription?.nearExpiry?.isNearExpiry && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-amber-300 font-medium">
            <Clock className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              Your subscription renews/expires in{' '}
              <strong>{subscription.nearExpiry.daysRemaining} day(s)</strong> on{' '}
              {subscription.currentPeriodEnd ? format(parseISO(subscription.currentPeriodEnd), 'dd MMM yyyy') : 'soon'}.
              Renew early to extend continuously without interruption.
            </span>
          </div>
          {currentPlan && (
            <Button
              size="sm"
              className="h-8 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-black shrink-0"
              onClick={() => openCheckoutModal(currentPlan, authoritativeCycle, 'RENEWAL')}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Renew Now
            </Button>
          )}
        </div>
      )}

      {subscription?.scheduledPlanChange?.status === 'SCHEDULED' && (
        <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5 text-purple-200 font-medium">
            <ArrowDownRight className="w-4 h-4 shrink-0 mt-0.5 text-purple-400" />
            <div>
              <span>
                Scheduled Plan Change: Switching to{' '}
                <strong>{subscription.scheduledPlanChange.targetPlanName}</strong> (
                {subscription.scheduledPlanChange.targetBillingCycle} &bull; ₹
                {Number(subscription.scheduledPlanChange.targetPriceRupees || 0).toLocaleString('en-IN')}) effective{' '}
                <strong>
                  {subscription.scheduledPlanChange.effectiveDate
                    ? format(parseISO(subscription.scheduledPlanChange.effectiveDate), 'dd MMM yyyy')
                    : 'next billing cycle'}
                </strong>
                . Your current entitlements stay active until that date.
              </span>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={isCancellingDowngrade}
            onClick={handleCancelScheduledDowngrade}
            className="h-8 text-xs shrink-0 border-purple-500/40"
          >
            {isCancellingDowngrade ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : (
              <Ban className="w-3.5 h-3.5 mr-1" />
            )}
            Cancel Scheduled Change
          </Button>
        </div>
      )}

      {/* 1. Top Section: Authoritative Current Subscription Card */}
      {subscription && (
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-foreground">
                    Current SaaS Subscription
                  </CardTitle>
                  <CardDescription>
                    {currentPlan?.description ||
                      'Authoritative subscription plan snapshot, usage quotas, and lifecycle controls.'}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {currentPlan && isActivePaid && (
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm text-xs h-8"
                    onClick={() => openCheckoutModal(currentPlan, authoritativeCycle, 'RENEWAL')}
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                    Renew Plan
                  </Button>
                )}
                {currentPlan && isTrial && (
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm text-xs h-8"
                    onClick={() => openCheckoutModal(currentPlan, authoritativeCycle, 'ACTIVATION')}
                  >
                    <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                    Activate Plan
                  </Button>
                )}
                {currentPlan && (isPendingOrFailed || isExpiredOrCancelled) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="font-semibold text-xs h-8"
                    onClick={() =>
                      openCheckoutModal(
                        currentPlan,
                        authoritativeCycle,
                        isExpiredOrCancelled ? 'REACTIVATION' : 'ACTIVATION'
                      )
                    }
                  >
                    <Ticket className="w-3.5 h-3.5 mr-1.5" />
                    Apply Voucher / Pay
                  </Button>
                )}
                {getStatusBadge(subscription.status)}
                {subscription.activationMethod && (
                  <Badge variant="secondary" className="text-[11px]">
                    {String(subscription.activationMethod).replace('_', ' ')}
                  </Badge>
                )}
                <Badge variant="outline" className="font-mono text-xs uppercase">
                  {authoritativeCycle}
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-secondary/30 border border-border/80">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  Assigned Plan
                </p>
                <p className="text-lg font-bold text-foreground mt-0.5">
                  {authoritativePlanName || 'Not Assigned'}
                </p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  Code: {authoritativePlanCode || '—'}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  Agreed Plan Price
                </p>
                <p className="text-lg font-bold text-foreground mt-0.5 flex items-center font-mono">
                  <IndianRupee className="w-4 h-4 mr-0.5 inline text-primary" />
                  {currentAgreedPrice !== null ? Number(currentAgreedPrice).toLocaleString('en-IN') : '—'}
                  <span className="text-xs text-muted-foreground font-normal font-sans ml-1">
                    / {authoritativeCycle === 'YEARLY' ? 'year' : 'month'}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {subscription.lastVoucherReference
                    ? `Voucher Ref: ${subscription.lastVoucherReference}`
                    : 'Locked plan pricing snapshot'}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  {isTrial ? 'Trial Ends On' : 'Current Period End'}
                </p>
                <p className="text-lg font-bold text-foreground mt-0.5">
                  {isTrial && subscription.trialEndsAt
                    ? format(parseISO(subscription.trialEndsAt), 'dd MMM yyyy')
                    : subscription.currentPeriodEnd
                    ? format(parseISO(subscription.currentPeriodEnd), 'dd MMM yyyy')
                    : 'Pending'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isTrial && subscription.trialStartsAt
                    ? `Started ${format(parseISO(subscription.trialStartsAt), 'dd MMM yyyy')}`
                    : subscription.currentPeriodStart
                    ? `Started ${format(parseISO(subscription.currentPeriodStart), 'dd MMM yyyy')}`
                    : 'Awaiting activation'}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  Capacity Usage
                </p>
                <div className="text-xs space-y-1 mt-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Students:</span>
                    <span className="font-mono font-semibold text-foreground">
                      {usage?.studentCount ?? 0} /{' '}
                      {limits?.maxStudents && limits.maxStudents > 0 ? limits.maxStudents : 'Unlimited'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Branches:</span>
                    <span className="font-mono font-semibold text-foreground">
                      {usage?.hostelCount ?? 0} /{' '}
                      {limits?.maxHostels && limits.maxHostels > 0 ? limits.maxHostels : 'Unlimited'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rooms:</span>
                    <span className="font-mono font-semibold text-foreground">
                      {usage?.roomCount ?? 0} /{' '}
                      {limits?.maxRooms && limits.maxRooms > 0 ? limits.maxRooms : 'Unlimited'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Enabled Modules */}
            {(subscription.enabledFeatures?.length || currentPlan?.includedFeatures?.length) ? (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase mr-1">
                  Active Features:
                </span>
                {(subscription.enabledFeatures && subscription.enabledFeatures.length > 0
                  ? subscription.enabledFeatures
                  : currentPlan?.includedFeatures || []
                ).map((feat) => (
                  <Badge key={feat} variant="secondary" className="text-[10px] capitalize">
                    {feat.replace(/_/g, ' ').toLowerCase()}
                  </Badge>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* 2. Middle Section: Authoritative Plans Catalog (Upgrade / Downgrade / Activate / Trial) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Available Hosteliq SaaS Plans
            </h2>
            <p className="text-sm text-muted-foreground">
              Manage your subscription directly from the authoritative platform catalog. Upgrade with instant proration or schedule a next-cycle change.
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
              {maxSavingsPct > 0 && (
                <span className="bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  Save up to {maxSavingsPct}%
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Plan Cards Grid */}
        {plans.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground text-sm">
            No active published plans returned by catalog.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            {plans.map((plan) => {
              const allowed = plan.allowedBillingCycles || ['MONTHLY', 'YEARLY'];
              const targetCycle: 'MONTHLY' | 'YEARLY' = allowed.includes(billingCycle)
                ? billingCycle
                : allowed[0] || 'MONTHLY';
              const price = targetCycle === 'YEARLY' ? plan.priceYearly : plan.priceMonthly;
              const isSamePlan = currentPlan?._id === plan._id || snapshot?.planId === plan._id;
              const isSameCycle = authoritativeCycle === targetCycle;

              // Determine lifecycle action for this card
              let actionType: 'CURRENT_RENEW' | 'TRIAL_ACTIVATE' | 'UPGRADE' | 'DOWNGRADE' | 'ACTIVATE' =
                'ACTIVATE';

              if (isSamePlan) {
                if (isTrial) {
                  actionType = 'TRIAL_ACTIVATE';
                } else if (isActivePaid && isSameCycle) {
                  actionType = 'CURRENT_RENEW';
                } else if (isActivePaid && !isSameCycle) {
                  actionType =
                    Number(price) > Number(currentAgreedPrice || 0) ? 'UPGRADE' : 'DOWNGRADE';
                } else {
                  actionType = 'ACTIVATE';
                }
              } else if (isActivePaid) {
                actionType =
                  Number(price) >= Number(currentAgreedPrice || 0) ? 'UPGRADE' : 'DOWNGRADE';
              } else if (isTrial) {
                actionType = 'UPGRADE';
              } else {
                actionType = 'ACTIVATE';
              }

              return (
                <Card
                  key={plan._id}
                  className={`relative flex flex-col justify-between transition-all duration-200 border-border ${
                    isSamePlan
                      ? 'border-primary shadow-lg ring-1 ring-primary/40'
                      : plan.isPopular
                      ? 'border-primary/60 shadow-md'
                      : 'hover:border-primary/50'
                  }`}
                >
                  {isSamePlan ? (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[10px] font-extrabold uppercase px-3 py-0.5 rounded-full tracking-wider shadow-sm">
                      {isTrial ? 'Current Trial Plan' : 'Current Plan'}
                    </div>
                  ) : plan.isPopular ? (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-extrabold uppercase px-3 py-0.5 rounded-full tracking-wider shadow-sm">
                      Most Popular
                    </div>
                  ) : null}

                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <CardTitle className="text-xl font-bold text-foreground">{plan.name}</CardTitle>
                        <CardDescription className="text-xs mt-1">{plan.description}</CardDescription>
                      </div>
                      {plan.trialEligible !== false && (
                        <Badge variant="outline" className="text-[10px] shrink-0 border-blue-500/30 text-blue-400">
                          {plan.trialDays || 14}d Trial
                        </Badge>
                      )}
                    </div>
                    <div className="mt-4">
                      <div className="flex items-baseline flex-wrap gap-1">
                        <span className="text-3xl font-extrabold text-foreground font-mono flex items-center">
                          <IndianRupee className="w-5 h-5 mr-0.5 inline text-primary" />
                          {(price ?? 0).toLocaleString('en-IN')}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          / {targetCycle === 'YEARLY' ? 'year' : 'month'}
                        </span>
                        {allowed.length === 1 && (
                          <span className="text-[10px] text-amber-400 ml-1">
                            ({targetCycle === 'YEARLY' ? 'Yearly only' : 'Monthly only'})
                          </span>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 flex-1">
                    <div className="grid grid-cols-2 gap-2 text-[11px] p-2.5 rounded-lg bg-secondary/30 border border-border/60">
                      <div>
                        <span className="text-muted-foreground block">Residents</span>
                        <span className="font-semibold text-foreground">
                          {plan.limits?.maxStudents > 0 ? `Up to ${plan.limits.maxStudents}` : 'Unlimited'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Branches</span>
                        <span className="font-semibold text-foreground">
                          {plan.limits?.maxHostels > 0 ? `Up to ${plan.limits.maxHostels}` : 'Unlimited'}
                        </span>
                      </div>
                    </div>

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

                  <div className="p-6 pt-0 space-y-2">
                    {actionType === 'CURRENT_RENEW' && (
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
                          onClick={() => openCheckoutModal(plan, targetCycle, 'RENEWAL')}
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1" />
                          Renew
                        </Button>
                      </div>
                    )}

                    {actionType === 'TRIAL_ACTIVATE' && (
                      <Button
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md text-xs"
                        onClick={() => openCheckoutModal(plan, targetCycle, 'ACTIVATION')}
                      >
                        <CreditCard className="w-4 h-4 mr-1.5" />
                        Activate {plan.name}
                      </Button>
                    )}

                    {actionType === 'UPGRADE' && (
                      <Button
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md text-xs"
                        onClick={() => handleOpenUpgrade(plan, targetCycle)}
                      >
                        <ArrowUpRight className="w-4 h-4 mr-1.5" />
                        {isTrial ? `Upgrade to ${plan.name}` : `Upgrade (Prorated)`}
                      </Button>
                    )}

                    {actionType === 'DOWNGRADE' && (
                      <Button
                        variant="outline"
                        className="w-full border-amber-500/40 text-amber-400 hover:bg-amber-500/10 font-semibold text-xs"
                        disabled={downgradeLoading}
                        onClick={() => handleOpenDowngrade(plan, targetCycle)}
                      >
                        <ArrowDownRight className="w-4 h-4 mr-1.5" />
                        Schedule Downgrade
                      </Button>
                    )}

                    {actionType === 'ACTIVATE' && (
                      <Button
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md text-xs"
                        onClick={() =>
                          openCheckoutModal(
                            plan,
                            targetCycle,
                            isExpiredOrCancelled ? 'REACTIVATION' : 'ACTIVATION'
                          )
                        }
                      >
                        <CreditCard className="w-4 h-4 mr-1.5" />
                        {isExpiredOrCancelled ? `Reactivate ${plan.name}` : `Activate ${plan.name}`}
                      </Button>
                    )}

                    {actions?.canStartTrial && plan.trialEligible !== false && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs text-blue-400 hover:text-blue-300"
                        disabled={isStartingTrial === plan._id}
                        onClick={() => handleStartTrial(plan, targetCycle)}
                      >
                        {isStartingTrial === plan._id ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 mr-1" />
                        )}
                        Or Start {plan.trialDays || 14}-Day Free Trial
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Bottom Section: Invoices, Payments & Lifecycle Audit History */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Billing History, Payment Attempts &amp; Subscription Log
          </CardTitle>
          <CardDescription>
            Official invoices, payment gateway attempts, and full plan lifecycle changes for your organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="invoices" className="space-y-4">
            <TabsList className="bg-muted/60 p-1 rounded-xl">
              <TabsTrigger value="invoices" className="text-xs">
                Invoices ({invoices.length})
              </TabsTrigger>
              <TabsTrigger value="payments" className="text-xs">
                Payment Attempts ({payments.length})
              </TabsTrigger>
              <TabsTrigger value="lifecycle" className="text-xs">
                Subscription History ({lifecycleHistory.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="invoices">
              {invoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No billing invoices issued yet. Paid activations and zero-payable activation vouchers generate invoices here.
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
                            ₹{(inv.totalRupees ?? 0).toLocaleString('en-IN')}
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
            </TabsContent>

            <TabsContent value="payments">
              {payments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No payment gateway attempts recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Intent</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Gateway Reference</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((pay) => (
                        <TableRow key={pay._id}>
                          <TableCell className="text-xs text-muted-foreground">
                            {pay.createdAt ? format(parseISO(pay.createdAt), 'dd MMM yyyy HH:mm') : '-'}
                          </TableCell>
                          <TableCell className="text-xs font-semibold text-foreground">
                            {pay.planSnapshot?.planName || pay.planId?.name || 'Plan'} ({pay.billingCycle || 'MONTHLY'})
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {pay.intent || 'ACTIVATION'}
                          </TableCell>
                          <TableCell className="text-xs font-mono font-bold text-foreground">
                            ₹{(pay.amountRupees ?? 0).toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={pay.status === 'FAILED' ? 'destructive' : 'outline'}
                              className={
                                pay.status === 'CAPTURED' || pay.status === 'PAID'
                                  ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-[10px]'
                                  : 'text-[10px]'
                              }
                            >
                              {pay.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {pay.paymentId || pay.failureReason || pay.orderId || '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="lifecycle">
              {lifecycleHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No subscription lifecycle events recorded yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {[...lifecycleHistory].reverse().map((item, idx) => (
                    <div
                      key={item._id || idx}
                      className="p-3 rounded-xl bg-secondary/20 border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <History className="w-3.5 h-3.5 text-primary" />
                          <span className="font-bold text-foreground">{item.eventType}</span>
                          {item.toPlanName && (
                            <Badge variant="outline" className="text-[10px]">
                              {item.toPlanName}
                            </Badge>
                          )}
                          {item.toStatus && (
                            <Badge variant="secondary" className="text-[10px]">
                              {item.toStatus}
                            </Badge>
                          )}
                        </div>
                        {item.notes && <p className="text-muted-foreground">{item.notes}</p>}
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                        {item.createdAt ? format(parseISO(item.createdAt), 'dd MMM yyyy HH:mm') : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 4. Standard Activation / Renewal / Voucher Checkout Modal */}
      {selectedPlanForCheckout && (
        <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
          <DialogContent className="sm:max-w-[500px] bg-card border-border rounded-2xl p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <DialogHeader className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-1">
                <CreditCard className="w-6 h-6" />
              </div>
              <DialogTitle className="text-xl font-bold text-foreground">
                {checkoutIntent === 'RENEWAL'
                  ? 'Renew Subscription'
                  : checkoutIntent === 'REACTIVATION'
                  ? 'Reactivate Subscription'
                  : 'Activate Subscription'}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Review plan summary, choose billing interval, redeem a secure voucher, or proceed to online checkout.
              </DialogDescription>
            </DialogHeader>

            {/* Plan Specs & Cycle Selector */}
            <div className="bg-secondary/40 border border-border/80 rounded-xl p-4 my-3 space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Selected Plan</span>
                <span className="font-semibold text-foreground">{selectedPlanForCheckout.name}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Billing Cycle</span>
                <div className="flex gap-1">
                  {(selectedPlanForCheckout.allowedBillingCycles || ['MONTHLY', 'YEARLY']).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setCheckoutCycle(c);
                        resetVoucherState();
                      }}
                      className={`px-2 py-0.5 rounded font-mono text-[10px] border ${
                        checkoutCycle === c
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-border'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
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
                  <span>Subscription Voucher / Activation / Trial Code</span>
                </div>
                {appliedVoucherPreview && (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                    {appliedVoucherPreview.voucherType || 'DISCOUNT'} Verified
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
                      {appliedVoucherPreview.benefitSummary && (
                        <p className="text-[11px] text-foreground mt-0.5">
                          {appliedVoucherPreview.benefitSummary}
                        </p>
                      )}
                    </div>
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
              )}
            </div>

            {/* Financial Summary Calculation */}
            <div className="bg-secondary/30 border border-border rounded-xl p-4 my-2 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Catalog Plan Price</span>
                <span className="font-semibold text-foreground">
                  ₹
                  {(checkoutCycle === 'YEARLY'
                    ? selectedPlanForCheckout.priceYearly
                    : selectedPlanForCheckout.priceMonthly
                  ).toLocaleString('en-IN')}
                </span>
              </div>

              {appliedVoucherPreview && appliedVoucherPreview.discountAmount > 0 && (
                <div className="flex justify-between items-center text-xs text-emerald-400">
                  <span className="font-medium flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Voucher Benefit
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
                      : checkoutCycle === 'YEARLY'
                      ? selectedPlanForCheckout.priceYearly
                      : selectedPlanForCheckout.priceMonthly
                    ).toLocaleString('en-IN')}
                    <span className="text-xs text-muted-foreground font-normal ml-1">
                      / {checkoutCycle === 'YEARLY' ? 'yr' : 'mo'}
                    </span>
                  </span>

                  {appliedVoucherPreview?.isZeroPayable && (
                    <span className="text-[11px] font-bold text-emerald-400 block mt-0.5">
                      {appliedVoucherPreview.voucherType === 'TRIAL'
                        ? `${appliedVoucherPreview.trialDaysGranted || 14}-Day Trial Voucher Ready`
                        : '₹0 Zero-Balance Activation Ready'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-4">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>
                {appliedVoucherPreview?.isZeroPayable
                  ? 'Zero-balance voucher entitlement processed atomically without gateway redirect.'
                  : 'One-time payment secured via Razorpay cryptographic verification.'}
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
                      {appliedVoucherPreview.voucherType === 'TRIAL'
                        ? `Activate ${appliedVoucherPreview.trialDaysGranted || 14}-Day Trial`
                        : 'Confirm & Activate (₹0)'}
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

      {/* 5. Upgrade Plan Quote & Proration Modal */}
      <Dialog open={upgradeModalOpen} onOpenChange={setUpgradeModalOpen}>
        <DialogContent className="sm:max-w-[540px] bg-card border-border rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-primary" />
              Upgrade Subscription Preview
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Server-calculated proration credit for remaining time on your current plan.
            </DialogDescription>
          </DialogHeader>

          {upgradeLoading || !upgradeQuote ? (
            <div className="py-10 flex flex-col items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span>Calculating upgrade proration...</span>
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-secondary/30 border border-border">
                  <span className="text-muted-foreground block">Current Plan</span>
                  <div className="font-bold text-sm text-foreground mt-0.5">
                    {upgradeQuote.currentPlan?.name || authoritativePlanName}
                  </div>
                  <div className="font-mono text-muted-foreground mt-0.5">
                    Agreed: ₹{upgradeQuote.currentAgreedPriceRupees.toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/30">
                  <span className="text-primary block font-medium">New Target Plan</span>
                  <div className="font-bold text-sm text-foreground mt-0.5">
                    {upgradeQuote.targetPlan.name} ({upgradeQuote.billingCycle})
                  </div>
                  <div className="font-mono text-foreground font-semibold mt-0.5">
                    Catalog: ₹{upgradeQuote.targetPriceRupees.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-secondary/40 border border-border space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target Plan Price</span>
                  <span className="font-mono font-semibold">
                    ₹{upgradeQuote.targetPriceRupees.toLocaleString('en-IN')}
                  </span>
                </div>
                {upgradeQuote.prorationCreditRupees > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Remaining-Cycle Proration Credit</span>
                    <span className="font-mono font-bold">
                      -₹{upgradeQuote.prorationCreditRupees.toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
                <div className="border-t border-border pt-2 flex justify-between items-center">
                  <span className="font-bold text-sm text-foreground">Final Upgrade Payable Now</span>
                  <span className="text-xl font-extrabold font-mono text-primary">
                    ₹{upgradeQuote.finalPayableRupees.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {upgradeQuote.addedFeatures?.length > 0 && (
                <div className="space-y-1.5">
                  <span className="font-semibold text-foreground block">Newly Unlocked Capabilities:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {upgradeQuote.addedFeatures.map((f) => (
                      <Badge key={f} variant="secondary" className="text-[10px] capitalize">
                        + {f.replace(/_/g, ' ').toLowerCase()}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs mr-auto"
                  onClick={() => {
                    setUpgradeModalOpen(false);
                    openCheckoutModal(upgradeQuote.targetPlan, upgradeQuote.billingCycle, 'UPGRADE');
                  }}
                >
                  <Ticket className="w-3.5 h-3.5 mr-1" /> Apply Voucher Instead
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setUpgradeModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isProcessingUpgrade}
                  onClick={handleConfirmUpgradePayment}
                  className="bg-primary text-primary-foreground font-semibold"
                >
                  {isProcessingUpgrade ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Opening Checkout...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-1.5" /> Pay ₹
                      {upgradeQuote.finalPayableRupees.toLocaleString('en-IN')} &amp; Upgrade
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 6. Downgrade Confirmation & Capacity Check Modal */}
      <Dialog open={downgradeModalOpen} onOpenChange={setDowngradeModalOpen}>
        <DialogContent className="sm:max-w-[520px] bg-card border-border rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Confirm Next-Cycle Downgrade
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Your current plan stays active until the end of the billing period. Review capacity &amp; feature changes below.
            </DialogDescription>
          </DialogHeader>

          {downgradeInfo && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-secondary/35 border border-border space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target Plan:</span>
                  <span className="font-bold text-foreground">
                    {downgradeInfo.plan.name} ({downgradeInfo.cycle})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Effective Date:</span>
                  <span className="font-mono font-semibold text-foreground">
                    {downgradeInfo.quote.effectiveDate
                      ? format(parseISO(downgradeInfo.quote.effectiveDate), 'dd MMM yyyy')
                      : 'Next Billing Cycle'}
                  </span>
                </div>
              </div>

              {downgradeInfo.quote.capacityWarnings?.length > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5 text-amber-200">
                  <div className="font-bold text-amber-300">Usage Exceeds Target Plan Limits:</div>
                  <ul className="list-disc pl-4 space-y-1">
                    {downgradeInfo.quote.capacityWarnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                  <p className="text-[11px] opacity-90 pt-1">
                    Existing records will be preserved, but adding new records above target limits will be restricted after the effective date.
                  </p>
                </div>
              )}

              {downgradeInfo.quote.removedFeatures?.length > 0 && (
                <div className="space-y-1.5">
                  <span className="font-semibold text-foreground block">
                    Features Disabled Starting Next Cycle:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {downgradeInfo.quote.removedFeatures.map((f) => (
                      <Badge key={f} variant="outline" className="text-[10px] text-amber-400 border-amber-500/30 capitalize">
                        - {f.replace(/_/g, ' ').toLowerCase()}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={downgradeLoading}
                  onClick={() => setDowngradeModalOpen(false)}
                >
                  Keep Current Plan
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={downgradeLoading}
                  onClick={handleConfirmOverCapacityDowngrade}
                  className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                >
                  {downgradeLoading ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  )}
                  Confirm Scheduled Downgrade
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
