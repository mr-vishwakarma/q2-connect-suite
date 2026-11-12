import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { INDIAN_STATES, getCitiesForState } from '@/constants/locations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  GitFork,
  UserCheck,
  CreditCard,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Upload,
  FileCheck,
  X,
  Sparkles,
  Eye,
  EyeOff,
  Wifi,
  Wind,
  Zap,
  Droplets,
  Video,
  Fingerprint,
  Dumbbell,
  BookOpen,
  Shirt,
  Flame,
  Refrigerator,
  Sparkle,
  Loader2,
  RefreshCw,
  Mail,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  Ticket,
  Tag,
  IndianRupee,
  Clock,
  LucideIcon,
} from 'lucide-react';
import { superAdminService, TenantOnboardingResult } from '@/services/api/superAdmin.service';
import { billingService, SaaSPlan } from '@/services/api/billing.service';
import { ApplyVoucherResponse } from '@/services/api/voucher.service';
import { openRazorpayOrderCheckout } from '@/utils/razorpay';
import { getErrorMessage } from '@/utils/errorHandling';
import { api } from '@/lib/api';
import { HostelAmenity, HostelGenderType, OnboardTenantPayload } from '@/types';
import { toast } from 'react-toastify';

interface OnboardTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const AMENITY_CONFIG: Array<{ value: HostelAmenity; label: string; icon: LucideIcon }> = [
  { value: HostelAmenity.WIFI, label: 'Wi-Fi 6', icon: Wifi },
  { value: HostelAmenity.AC, label: 'Air Conditioning', icon: Wind },
  { value: HostelAmenity.POWER_BACKUP, label: '24x7 Power Backup', icon: Zap },
  { value: HostelAmenity.RO_WATER, label: 'RO Drinking Water', icon: Droplets },
  { value: HostelAmenity.CCTV, label: 'CCTV Surveillance', icon: Video },
  { value: HostelAmenity.BIOMETRIC_ACCESS, label: 'Biometric Access', icon: Fingerprint },
  { value: HostelAmenity.GYM, label: 'Fitness Center / Gym', icon: Dumbbell },
  { value: HostelAmenity.STUDY_LIBRARY, label: 'Study Library', icon: BookOpen },
  { value: HostelAmenity.LAUNDRY, label: 'Washing Machine', icon: Shirt },
  { value: HostelAmenity.HOT_WATER, label: 'Geyser Hot Water', icon: Flame },
  { value: HostelAmenity.REFRIGERATOR, label: 'Common Refrigerator', icon: Refrigerator },
  { value: HostelAmenity.HOUSEKEEPING, label: 'Daily Housekeeping', icon: Sparkle },
];

export function OnboardTenantModal({ isOpen, onClose, onSuccess }: OnboardTenantModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAadhaar, setIsUploadingAadhaar] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [provisioningResult, setProvisioningResult] = useState<TenantOnboardingResult | null>(null);
  const [isResendingAdmin, setIsResendingAdmin] = useState(false);
  const [isResendingWarden, setIsResendingWarden] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Authoritative Live Plan Catalog
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);

  // Step 5 Subscription Activation State
  const [activationMethodTab, setActivationMethodTab] = useState<'ONLINE' | 'VOUCHER' | 'TRIAL'>('ONLINE');
  const [isActivating, setIsActivating] = useState(false);
  const [isGatewayOpen, setIsGatewayOpen] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [activationMeta, setActivationMeta] = useState<{ invoiceNumber?: string; voucherReference?: string } | null>(null);

  // Voucher Redemption State inside Step 5
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherPin, setVoucherPin] = useState('');
  const [isPinVisible, setIsPinVisible] = useState(false);
  const [isPreviewingVoucher, setIsPreviewingVoucher] = useState(false);
  const [voucherPreview, setVoucherPreview] = useState<ApplyVoucherResponse | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<OnboardTenantPayload>({
    // Stage 1: Organization & KYC
    name: '',
    legalName: '',
    slug: '',
    contactEmail: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    aadhaarNumber: '',
    aadhaarDocument: '',
    gstin: '',
    pan: '',
    orgType: 'Multi-Branch Chain',
    primaryColor: '#f59e0b',

    // Stage 2: Property & Amenities
    branchName: '',
    branchCode: 'MAIN',
    genderType: 'GIRLS',
    propertyAddress: '',
    capacity: 120,
    floors: 3,
    totalRooms: 40,
    amenities: [
      HostelAmenity.WIFI,
      HostelAmenity.RO_WATER,
      HostelAmenity.CCTV,
      HostelAmenity.POWER_BACKUP,
      HostelAmenity.HOT_WATER,
    ],
    wardenName: '',
    wardenPhone: '',
    emergencyContact: '',

    // Stage 3: Primary Administrator Account
    adminName: '',
    adminEmail: '',
    adminUsername: '',
    adminPhone: '',
    adminPassword: '',
    adminDesignation: 'General Manager',

    // Stage 4: Authoritative SaaS Plan Selection (selected live from catalog)
    planId: '',
    planCode: '',
    billingCycle: 'MONTHLY',
    activationMode: 'PENDING_PAYMENT',
  });

  const loadLivePlans = useCallback(async () => {
    try {
      setPlansLoading(true);
      setPlansError(null);
      const livePlans = await billingService.getPlans(true);
      const sorted = [...(livePlans || [])].sort(
        (a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100) || a.priceMonthly - b.priceMonthly
      );
      setPlans(sorted);

      if (sorted.length > 0) {
        setFormData((prev) => {
          const existingMatch = sorted.find((p) => p._id === prev.planId);
          const chosen = existingMatch || sorted[0];
          const allowed = chosen.allowedBillingCycles || ['MONTHLY', 'YEARLY'];
          const currentCycle = prev.billingCycle || 'MONTHLY';
          const validCycle = allowed.includes(currentCycle) ? currentCycle : allowed[0] || 'MONTHLY';
          return {
            ...prev,
            planId: chosen._id,
            planCode: chosen.code,
            billingCycle: validCycle,
          };
        });
      }
    } catch (err: unknown) {
      console.error('Failed to load live plans:', err);
      setPlansError(getErrorMessage(err, 'Unable to load published subscription plans from catalog.'));
    } finally {
      setPlansLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadLivePlans();
    }
  }, [isOpen, loadLivePlans]);

  const selectedPlan = plans.find((p) => p._id === formData.planId) || null;

  const resetActivationState = () => {
    setActivationError(null);
    setActivationMeta(null);
    setVoucherCode('');
    setVoucherPin('');
    setIsPinVisible(false);
    setVoucherPreview(null);
    setVoucherError(null);
    setActivationMethodTab('ONLINE');
  };

  // Slug auto-generator
  const handleNameChange = (val: string) => {
    const slug = val.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    setFormData((prev) => ({
      ...prev,
      name: val,
      slug: prev.slug === '' || prev.slug === prev.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') ? slug : prev.slug,
      branchName: prev.branchName === '' ? `${val} - Main Campus` : prev.branchName,
    }));
  };

  // Generate strong random password
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$';
    let pwd = '';
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    pwd += '@26!';
    setFormData((prev) => ({ ...prev, adminPassword: pwd }));
    toast.info('Secure temporary password generated!');
  };

  // Handle Aadhaar Document Upload
  const handleAadhaarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast.error('Please upload an image (JPG/PNG) or PDF document');
      return;
    }

    try {
      setIsUploadingAadhaar(true);
      const data = new FormData();
      data.append('file', file);

      const res = await api.post('/upload/file', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.url) {
        setFormData((prev) => ({ ...prev, aadhaarDocument: res.data.url }));
        toast.success('Aadhaar document uploaded successfully!');
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to upload document'));
    } finally {
      setIsUploadingAadhaar(false);
    }
  };

  // Toggle Amenity Pill Selection
  const toggleAmenity = (amenity: HostelAmenity) => {
    setFormData((prev) => {
      const current = prev.amenities || [];
      if (current.includes(amenity)) {
        return { ...prev, amenities: current.filter((a) => a !== amenity) };
      } else {
        return { ...prev, amenities: [...current, amenity] };
      }
    });
  };

  // Step validation
  const validateStep = (step: number): boolean => {
    if (step === 1) {
      if (!formData.name.trim()) {
        toast.error('Organization Brand Name is required');
        return false;
      }
      if (!formData.contactEmail.trim() || !formData.contactEmail.includes('@')) {
        toast.error('Valid Contact Email is required');
        return false;
      }
      if (!formData.state?.trim()) {
        toast.error('State is required');
        return false;
      }
      if (!formData.city?.trim()) {
        toast.error('City is required');
        return false;
      }
      if (!formData.aadhaarNumber || formData.aadhaarNumber.replace(/\D/g, '').length !== 12) {
        toast.error('Statutory KYC: A valid 12-digit Aadhaar Number is required');
        return false;
      }
      if (!formData.aadhaarDocument) {
        toast.error('Statutory KYC: Aadhaar card document upload is mandatory for onboarding verification');
        return false;
      }
      return true;
    }

    if (step === 2) {
      if (!formData.branchName?.trim()) {
        toast.error('Primary Branch Name is required');
        return false;
      }
      if (!formData.branchCode?.trim()) {
        toast.error('Branch Code identifier is required');
        return false;
      }
      return true;
    }

    if (step === 3) {
      if (!formData.adminName?.trim()) {
        toast.error('Administrator Name is required');
        return false;
      }
      if (!formData.adminEmail?.trim() || !formData.adminEmail.includes('@')) {
        toast.error('Administrator Login Email is required');
        return false;
      }
      if (!formData.adminPassword || formData.adminPassword.length < 6) {
        toast.error('Temporary password must be at least 6 characters');
        return false;
      }
      return true;
    }

    if (step === 4) {
      if (!formData.planId || !selectedPlan) {
        toast.error('Please select an active published subscription plan from the catalog');
        return false;
      }
      return true;
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const handleBack = () => {
    if (currentStep <= 4) {
      setCurrentStep((prev) => Math.max(prev - 1, 1));
    }
  };

  // Resend Handlers
  const handleResendAdminInvite = async () => {
    if (!provisioningResult?.adminAccount?.id) return;
    try {
      setIsResendingAdmin(true);
      const res = await superAdminService.resendInvitation(provisioningResult.adminAccount.id);
      if (res.success) {
        toast.success('Admin welcome invitation re-dispatched successfully!');
        setProvisioningResult((prev) =>
          prev
            ? {
                ...prev,
                adminAccount: prev.adminAccount
                  ? {
                      ...prev.adminAccount,
                      invitationEmailStatus: res.data?.user?.invitationEmailStatus || 'sent',
                      invitationEmailError: null,
                    }
                  : undefined,
              }
            : prev
        );
      } else {
        toast.error(res.message || 'Failed to resend invitation email');
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Error resending invitation'));
    } finally {
      setIsResendingAdmin(false);
    }
  };

  const handleResendWardenInvite = async () => {
    if (!provisioningResult?.wardenAccount?.id) return;
    try {
      setIsResendingWarden(true);
      const res = await superAdminService.resendInvitation(provisioningResult.wardenAccount.id);
      if (res.success) {
        toast.success('Warden invitation re-sent to Hostel Admin successfully!');
        setProvisioningResult((prev) =>
          prev
            ? {
                ...prev,
                wardenAccount: prev.wardenAccount
                  ? {
                      ...prev.wardenAccount,
                      invitationEmailStatus: res.data?.user?.invitationEmailStatus || 'sent',
                      invitationEmailError: null,
                    }
                  : undefined,
              }
            : prev
        );
      } else {
        toast.error(res.message || 'Failed to resend warden invitation');
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Error resending warden invitation'));
    } finally {
      setIsResendingWarden(false);
    }
  };

  // Step 4 -> Create Tenant + PENDING_PAYMENT Subscription -> Move to Step 5 Activation
  const handleCreateTenantAndProceed = async () => {
    if (!validateStep(4)) return;
    if (provisioningResult?.organization?._id) {
      setCurrentStep(5);
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: OnboardTenantPayload = {
        ...formData,
        planId: selectedPlan!._id,
        planCode: selectedPlan!.code,
        billingCycle: formData.billingCycle || 'MONTHLY',
        activationMode: 'PENDING_PAYMENT',
      };
      const res = await superAdminService.createOrganization(payload);
      if (res.success && res.data) {
        toast.success(`Organization '${formData.name}' created on ${selectedPlan!.name}. Choose an activation method next.`);
        setProvisioningResult(res.data);
        resetActivationState();
        setCurrentStep(5);
        onSuccess?.();
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to onboard organization'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const orgId = provisioningResult?.organization?._id || provisioningResult?.organization?.id;
  const subCycle = (provisioningResult?.subscription?.billingCycle || formData.billingCycle || 'MONTHLY') as 'MONTHLY' | 'YEARLY';
  const rawPlanId = provisioningResult?.subscription?.planId;
  const activePlanId =
    (typeof rawPlanId === 'string' ? rawPlanId : rawPlanId?._id || rawPlanId?.id) ||
    formData.planId ||
    '';

  // Step 5 Option A: Online Payment (Razorpay)
  const handleOnlinePaymentActivation = async () => {
    if (!orgId || !activePlanId) return;
    try {
      setIsActivating(true);
      setActivationError(null);
      const initRes = await superAdminService.initiateOrgPayment(orgId, {
        planId: activePlanId,
        billingCycle: subCycle,
        intent: 'ACTIVATION',
      });
      const checkout = initRes.data;
      if (!checkout?.orderId || !checkout?.keyId) {
        throw new Error('Gateway order could not be initialized');
      }

      setIsGatewayOpen(true);
      await openRazorpayOrderCheckout(
        {
          orderId: checkout.orderId,
          keyId: checkout.keyId,
          amountPaise: checkout.amountPaise,
          currency: checkout.currency || 'INR',
          organizationName: formData.name || 'Hosteliq Organization',
          adminEmail: formData.adminEmail || formData.contactEmail,
          adminPhone: formData.adminPhone || formData.phone,
          description: `Hosteliq Onboarding - ${checkout.planName} (${subCycle})`,
        },
        async (rzpResponse) => {
          setIsGatewayOpen(false);
          try {
            const verifyRes = await superAdminService.verifyOrgPayment(orgId, {
              razorpay_order_id: rzpResponse.razorpay_order_id,
              razorpay_payment_id: rzpResponse.razorpay_payment_id,
              razorpay_signature: rzpResponse.razorpay_signature,
            });
            const verifiedData = verifyRes.data;
            setProvisioningResult((prev) =>
              prev
                ? {
                    ...prev,
                    subscription: verifiedData?.subscription || {
                      ...(prev.subscription || { _id: '', billingCycle: subCycle }),
                      status: 'ACTIVE',
                      activationMethod: 'ONLINE_PAYMENT',
                    },
                  }
                : prev
            );
            setActivationMeta({ invoiceNumber: verifiedData?.invoiceNumber });
            toast.success(`Online payment verified! Subscription is now ACTIVE.`);
            setCurrentStep(6);
            onSuccess?.();
          } catch (verifyErr: unknown) {
            const msg = getErrorMessage(verifyErr, 'Payment verification failed');
            setActivationError(msg);
            toast.error(msg);
          } finally {
            setIsActivating(false);
          }
        },
        async (failErr) => {
          setIsGatewayOpen(false);
          const reason = failErr?.description || failErr?.message || 'Payment cancelled or failed';
          setActivationError(reason);
          try {
            await superAdminService.recordOrgPaymentFailure(orgId, {
              orderId: checkout.orderId,
              code: failErr?.code,
              reason,
            });
          } catch {
            // ignore logging error
          }
          toast.error(reason);
          setIsActivating(false);
        }
      );
    } catch (err: unknown) {
      setIsGatewayOpen(false);
      const msg = getErrorMessage(err, 'Online payment initialization failed');
      setActivationError(msg);
      toast.error(msg);
      setIsActivating(false);
    }
  };

  // Step 5 Option B: Voucher Preview + Redeem (Zero/Trial/Partial)
  const handlePreviewVoucher = async () => {
    if (!orgId || !activePlanId) return;
    if (!voucherCode.trim() || !voucherPin.trim()) {
      setVoucherError('Enter both 16-character voucher code and 6-digit PIN');
      return;
    }
    try {
      setIsPreviewingVoucher(true);
      setVoucherError(null);
      const res = await superAdminService.previewOrgVoucher(orgId, {
        code: voucherCode.trim(),
        pin: voucherPin.trim(),
        planId: activePlanId,
        billingCycle: subCycle,
      });
      const preview: ApplyVoucherResponse = res.data;
      setVoucherPreview(preview);
      toast.success(preview.benefitSummary || 'Voucher verified and ready to redeem!');
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Voucher could not be applied');
      setVoucherError(msg);
      setVoucherPreview(null);
      toast.error(msg);
    } finally {
      setIsPreviewingVoucher(false);
    }
  };

  const handleConfirmVoucherRedemption = async () => {
    if (!orgId || !activePlanId || !voucherPreview) return;
    try {
      setIsActivating(true);
      setActivationError(null);

      if (voucherPreview.isZeroPayable) {
        const res = await superAdminService.redeemOrgVoucher(orgId, {
          code: voucherCode.trim(),
          pin: voucherPin.trim(),
          planId: activePlanId,
          billingCycle: subCycle,
          idempotencyKey: `onboard_voucher_${orgId}_${Date.now()}`,
        });
        const resultData = res.data;
        setProvisioningResult((prev) =>
          prev
            ? {
                ...prev,
                subscription: resultData?.subscription || {
                  ...(prev.subscription || { _id: '', billingCycle: subCycle }),
                  status: resultData?.status || (voucherPreview.voucherType === 'TRIAL' ? 'TRIAL' : 'ACTIVE'),
                  activationMethod: 'VOUCHER',
                },
              }
            : prev
        );
        setActivationMeta({
          invoiceNumber: resultData?.invoiceNumber || undefined,
          voucherReference: voucherPreview.voucherReference,
        });
        toast.success(`Voucher redeemed! Subscription is now ${resultData?.status || 'ACTIVE'}.`);
        setCurrentStep(6);
        onSuccess?.();
        setIsActivating(false);
        return;
      }

      // Partial Discount -> Reserve + Razorpay + Verify
      const reserveRes = await superAdminService.reserveOrgVoucherPartial(orgId, {
        code: voucherCode.trim(),
        pin: voucherPin.trim(),
        planId: activePlanId,
        billingCycle: subCycle,
      });
      const reservation = reserveRes.data;
      setIsGatewayOpen(true);
      await openRazorpayOrderCheckout(
        {
          orderId: reservation.orderId,
          keyId: reservation.keyId,
          amountPaise: reservation.amountPaise,
          currency: reservation.currency || 'INR',
          organizationName: formData.name || 'Hosteliq Organization',
          adminEmail: formData.adminEmail || formData.contactEmail,
          description: `Discounted Activation - ${reservation.planName} (${subCycle})`,
        },
        async (rzpResponse) => {
          setIsGatewayOpen(false);
          try {
            const verifyRes = await superAdminService.verifyOrgVoucherPartial(orgId, {
              checkoutSessionId: reservation.checkoutSessionId,
              razorpay_order_id: rzpResponse.razorpay_order_id,
              razorpay_payment_id: rzpResponse.razorpay_payment_id,
              razorpay_signature: rzpResponse.razorpay_signature,
            });
            const verifiedData = verifyRes.data;
            setProvisioningResult((prev) =>
              prev
                ? {
                    ...prev,
                    subscription: verifiedData?.subscription || {
                      ...(prev.subscription || { _id: '', billingCycle: subCycle }),
                      status: 'ACTIVE',
                      activationMethod: 'VOUCHER',
                    },
                  }
                : prev
            );
            setActivationMeta({
              invoiceNumber: verifiedData?.invoiceNumber,
              voucherReference: voucherPreview.voucherReference,
            });
            toast.success(`Discounted payment verified! Subscription ACTIVE.`);
            setCurrentStep(6);
            onSuccess?.();
          } catch (verifyErr: unknown) {
            const msg = getErrorMessage(verifyErr, 'Verification failed');
            setActivationError(msg);
            toast.error(msg);
          } finally {
            setIsActivating(false);
          }
        },
        async (failErr) => {
          setIsGatewayOpen(false);
          const reason = failErr?.description || failErr?.message || 'Payment dismissed';
          setActivationError(reason);
          try {
            await superAdminService.recordOrgPaymentFailure(orgId, {
              orderId: reservation.orderId,
              reason,
            });
          } catch {
            // ignore
          }
          toast.error(reason);
          setIsActivating(false);
        }
      );
    } catch (err: unknown) {
      setIsGatewayOpen(false);
      const msg = getErrorMessage(err, 'Failed to redeem voucher');
      setActivationError(msg);
      toast.error(msg);
      setIsActivating(false);
    }
  };

  // Step 5 Option C: Free Trial Activation
  const handleStartFreeTrialActivation = async () => {
    if (!orgId || !activePlanId) return;
    try {
      setIsActivating(true);
      setActivationError(null);
      const res = await superAdminService.startOrgTrial(orgId, {
        planId: activePlanId,
        billingCycle: subCycle,
        trialDays: selectedPlan?.trialDays || 14,
      });
      const resultData = res.data;
      setProvisioningResult((prev) =>
        prev
          ? {
              ...prev,
              subscription: resultData?.subscription || {
                ...(prev.subscription || { _id: '', billingCycle: subCycle }),
                status: 'TRIAL',
                activationMethod: 'FREE_TRIAL',
              },
            }
          : prev
      );
      toast.success(`${resultData?.trialDays || selectedPlan?.trialDays || 14}-day free trial activated!`);
      setCurrentStep(6);
      onSuccess?.();
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Failed to activate free trial');
      setActivationError(msg);
      toast.error(msg);
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} modal={!isGatewayOpen}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-card border-border shadow-2xl">
        {/* Header with Stepper */}
        <div className="bg-gradient-to-r from-amber-500/15 via-background to-amber-500/5 p-6 border-b border-border/80">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold text-foreground">
                    {currentStep === 6
                      ? 'Onboarding & Provisioning Complete'
                      : currentStep === 5
                      ? 'Activate Tenant Subscription'
                      : 'Hostel Organization Onboarding'}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    {currentStep === 6
                      ? 'Review the subscription activation, provisioned hostel property, administrator account, warden credentials, and email status.'
                      : currentStep === 5
                      ? 'Complete subscription activation via online payment, cryptographic voucher, eligible free trial, or leave pending.'
                      : 'Stage-by-stage tenant setup with KYC, property branch, administrator, and authoritative SaaS plan.'}
                  </DialogDescription>
                </div>
              </div>
              <Badge
                variant="outline"
                className={`border-amber-500/30 text-amber-400 font-mono text-xs px-3 py-1 ${
                  currentStep === 6 ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' : ''
                }`}
              >
                {currentStep === 6 ? 'Completed' : `Step ${currentStep} of 5`}
              </Badge>
            </div>
          </DialogHeader>

          {/* 6-Step Progress Bar */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mt-5">
            {[
              { num: 1, label: 'KYC & Entity' },
              { num: 2, label: 'Property' },
              { num: 3, label: 'Admin Account' },
              { num: 4, label: 'Select Plan' },
              { num: 5, label: 'Activate' },
              { num: 6, label: 'Summary' },
            ].map((step) => {
              const isPassed = currentStep > step.num;
              const isCurrent = currentStep === step.num;

              return (
                <div
                  key={step.num}
                  className={`flex items-center gap-1.5 p-1.5 rounded-lg border transition-all ${
                    isCurrent
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 font-semibold'
                      : isPassed
                      ? 'bg-secondary/60 border-border text-foreground'
                      : 'bg-transparent border-transparent text-muted-foreground opacity-60'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] shrink-0 ${
                      isPassed
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : isCurrent
                        ? 'bg-amber-500 text-black font-bold'
                        : 'bg-secondary text-muted-foreground'
                    }`}
                  >
                    {isPassed ? <CheckCircle2 className="w-3 h-3" /> : step.num}
                  </div>
                  <span className="text-[11px] truncate hidden sm:inline">{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>


        {/* Modal Body - Scrollable Step Views */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {/* STEP 1: ORGANIZATION & AADHAAR KYC */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="orgName">Organization Brand Name *</Label>
                  <Input
                    id="orgName"
                    required
                    placeholder="e.g., Apex Living Group"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="legalName">Legal Business / Entity Name</Label>
                  <Input
                    id="legalName"
                    placeholder="e.g., Apex Hospitality & Living Pvt. Ltd."
                    value={formData.legalName}
                    onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="orgType">Organization Type</Label>
                  <select
                    id="orgType"
                    className="w-full h-10 px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={formData.orgType}
                    onChange={(e) => setFormData({ ...formData, orgType: e.target.value })}
                  >
                    <option value="Single Hostel Owner">Single Hostel Owner</option>
                    <option value="Multi-Branch Chain">Multi-Branch Chain</option>
                    <option value="Student Housing Trust">Student Housing Trust</option>
                    <option value="Co-Living PG Network">Co-Living PG Network</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="slug">Slug URL Identifier</Label>
                  <Input
                    id="slug"
                    placeholder="apex-living"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contactEmail">Official Contact Email *</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    required
                    placeholder="contact@apexliving.com"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  />
                </div>
              </div>

              {/* Aadhaar Verification Card */}
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-amber-400">
                    <FileCheck className="w-4 h-4" />
                    <span>Aadhaar Identity & KYC Verification</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">Statutory Compliance</Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="aadhaarNumber">12-Digit Aadhaar Card Number</Label>
                    <Input
                      id="aadhaarNumber"
                      maxLength={14}
                      placeholder="XXXX XXXX XXXX"
                      value={formData.aadhaarNumber}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '').slice(0, 12);
                        const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ');
                        setFormData({ ...formData, aadhaarNumber: formatted });
                      }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Aadhaar Card Document / Photo</Label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*,application/pdf"
                      onChange={handleAadhaarUpload}
                    />

                    {formData.aadhaarDocument ? (
                      <div className="flex items-center justify-between p-2 rounded-lg bg-card border border-emerald-500/30 text-xs">
                        <div className="flex items-center gap-2 truncate text-emerald-400">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span className="truncate">Document Uploaded</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => setFormData({ ...formData, aadhaarDocument: '' })}
                        >
                          <X className="w-3.5 h-3.5 mr-1" /> Remove
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full border-dashed text-xs h-10 border-border hover:border-amber-500/60"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingAadhaar}
                      >
                        {isUploadingAadhaar ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin text-amber-500" />
                            Uploading to ImageKit...
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                            Upload Photo (Front & Back)
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Tax Compliance & Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="gstin">GSTIN (Optional)</Label>
                  <Input
                    id="gstin"
                    maxLength={15}
                    placeholder="e.g., 36AAAAA0000A1Z5"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pan">Business PAN / TAN (Optional)</Label>
                  <Input
                    id="pan"
                    maxLength={10}
                    placeholder="e.g., ABCDE1234F"
                    value={formData.pan}
                    onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor="phone">Official Phone</Label>
                  <Input
                    id="phone"
                    placeholder="+91 9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor="state">State</Label>
                  <Select
                    value={formData.state}
                    onValueChange={(val) => setFormData((prev) => ({ ...prev, state: val, city: '' }))}
                  >
                    <SelectTrigger id="state" className="h-9 text-xs">
                      <SelectValue placeholder="Select State" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {INDIAN_STATES.map((st) => (
                        <SelectItem key={st} value={st} className="text-xs">
                          {st}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor="city">City</Label>
                  <Select
                    value={formData.city}
                    onValueChange={(val) => setFormData((prev) => ({ ...prev, city: val }))}
                    disabled={!formData.state}
                  >
                    <SelectTrigger id="city" className="h-9 text-xs">
                      <SelectValue placeholder={formData.state ? 'Select City' : 'Select state first'} />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {getCitiesForState(formData.state).map((ct) => (
                        <SelectItem key={ct} value={ct} className="text-xs">
                          {ct}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input
                    id="pincode"
                    placeholder="500081"
                    maxLength={6}
                    className="h-9 text-xs"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value.replace(/\D/g, '') })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PROPERTY & AMENITIES */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="branchName">Primary Branch Name *</Label>
                  <Input
                    id="branchName"
                    required
                    placeholder="e.g., Apex Emerald - North Campus"
                    value={formData.branchName}
                    onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="branchCode">Branch Code Prefix *</Label>
                  <Input
                    id="branchCode"
                    required
                    maxLength={8}
                    placeholder="AEX-NC"
                    value={formData.branchCode}
                    onChange={(e) => setFormData({ ...formData, branchCode: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              {/* Gender & Capacity Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label>Gender Type</Label>
                  <div className="flex rounded-md border border-input p-1 bg-background">
                    {(['GIRLS', 'BOYS', 'COED'] as HostelGenderType[]).map((gender) => (
                      <button
                        key={gender}
                        type="button"
                        onClick={() => setFormData({ ...formData, genderType: gender })}
                        className={`flex-1 py-1 text-xs rounded font-medium transition-all ${
                          formData.genderType === gender
                            ? 'bg-amber-500 text-black shadow'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {gender}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="floors">Floors</Label>
                  <Input
                    id="floors"
                    type="number"
                    min={1}
                    value={formData.floors}
                    onChange={(e) => setFormData({ ...formData, floors: Number(e.target.value) })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="rooms">Total Rooms</Label>
                  <Input
                    id="rooms"
                    type="number"
                    min={1}
                    value={formData.totalRooms}
                    onChange={(e) => setFormData({ ...formData, totalRooms: Number(e.target.value) })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="capacity">Bed Capacity</Label>
                  <Input
                    id="capacity"
                    type="number"
                    min={1}
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                  />
                </div>
              </div>

              {/* Selectable Amenities Enum Pills */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-foreground">
                    Select Available Amenities (Enum Options)
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {formData.amenities?.length || 0} selected
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {AMENITY_CONFIG.map(({ value, label, icon: Icon }) => {
                    const isSelected = formData.amenities?.includes(value);

                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggleAmenity(value)}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left text-xs transition-all ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-semibold shadow-sm'
                            : 'bg-card border-border/80 text-muted-foreground hover:border-border hover:text-foreground'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-amber-500 text-black' : 'bg-secondary text-muted-foreground'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="truncate flex-1">{label}</span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Warden / Manager in-charge */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="wardenName">Warden / Manager Name</Label>
                  <Input
                    id="wardenName"
                    placeholder="e.g., Mrs. Lakshmi Rao"
                    value={formData.wardenName}
                    onChange={(e) => setFormData({ ...formData, wardenName: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wardenPhone">Warden Phone</Label>
                  <Input
                    id="wardenPhone"
                    placeholder="+91 9988776655"
                    value={formData.wardenPhone}
                    onChange={(e) => setFormData({ ...formData, wardenPhone: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="emergencyContact">24x7 Emergency Contact</Label>
                  <Input
                    id="emergencyContact"
                    placeholder="+91 9112233445"
                    value={formData.emergencyContact}
                    onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: ADMINISTRATOR ACCOUNT */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 flex items-start gap-3">
                <UserCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground block mb-0.5">Primary Tenant Administrator</span>
                  This administrator will receive full Organization Owner rights, branch access, student records management, and staff account provisioning.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="adminName">Administrator Full Name *</Label>
                  <Input
                    id="adminName"
                    required
                    placeholder="e.g., Rajesh Kumar"
                    value={formData.adminName}
                    onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="adminDesignation">Designation / Role</Label>
                  <Input
                    id="adminDesignation"
                    placeholder="e.g., Managing Director / Head Warden"
                    value={formData.adminDesignation}
                    onChange={(e) => setFormData({ ...formData, adminDesignation: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="adminEmail">Official Login Email *</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    required
                    placeholder="rajesh@apexliving.com"
                    value={formData.adminEmail}
                    onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="adminPhone">Mobile & WhatsApp Number</Label>
                  <Input
                    id="adminPhone"
                    placeholder="+91 9876543210"
                    value={formData.adminPhone}
                    onChange={(e) => setFormData({ ...formData, adminPhone: e.target.value })}
                  />
                </div>
              </div>

              {/* Password Section */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="adminPassword">Initial Temporary Password *</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-amber-400 hover:text-amber-300 gap-1 p-0"
                    onClick={generatePassword}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Auto-Generate Password
                  </Button>
                </div>
                <div className="relative">
                  <Input
                    id="adminPassword"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter or generate temporary password"
                    value={formData.adminPassword}
                    onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  The administrator will be prompted to reset their password upon first sign-in.
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: AUTHORITATIVE SAAS SUBSCRIPTION PLAN & BILLING FREQUENCY */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Label className="text-sm font-semibold text-foreground">
                      Published SaaS Plan Catalog
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Select an authoritative plan from Super Admin Plans &amp; Pricing. The exact plan and pricing snapshot are saved to this tenant.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={loadLivePlans}
                    disabled={plansLoading}
                    className="h-7 text-xs gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${plansLoading ? 'animate-spin' : ''}`} />
                    Refresh Catalog
                  </Button>
                </div>

                {plansLoading ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground gap-2 text-xs border border-border rounded-xl">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    <span>Loading published subscription plans...</span>
                  </div>
                ) : plansError ? (
                  <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-xs text-destructive flex items-center justify-between gap-3">
                    <span>{plansError}</span>
                    <Button type="button" size="sm" variant="outline" onClick={loadLivePlans}>
                      Retry
                    </Button>
                  </div>
                ) : plans.length === 0 ? (
                  <div className="p-6 rounded-xl border border-amber-500/30 bg-amber-500/10 text-center space-y-2 text-xs">
                    <AlertCircle className="w-6 h-6 text-amber-400 mx-auto" />
                    <p className="font-semibold text-foreground">No Published Active Plans Available</p>
                    <p className="text-muted-foreground">
                      Publish at least one active plan under Super Admin → Plans &amp; Pricing before onboarding a tenant.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {plans.map((plan) => {
                      const isSelected = formData.planId === plan._id;
                      const allowed = plan.allowedBillingCycles || ['MONTHLY', 'YEARLY'];
                      const effectiveCycle = allowed.includes(formData.billingCycle || 'MONTHLY')
                        ? formData.billingCycle || 'MONTHLY'
                        : allowed[0] || 'MONTHLY';
                      const displayPrice =
                        effectiveCycle === 'YEARLY' ? plan.priceYearly : plan.priceMonthly;
                      const maxStudents = plan.limits?.maxStudents ?? 0;
                      const maxHostels = plan.limits?.maxHostels ?? 0;

                      return (
                        <div
                          key={plan._id}
                          onClick={() => {
                            const nextCycle = allowed.includes(formData.billingCycle || 'MONTHLY')
                              ? formData.billingCycle || 'MONTHLY'
                              : allowed[0] || 'MONTHLY';
                            setFormData((prev) => ({
                              ...prev,
                              planId: plan._id,
                              planCode: plan.code,
                              billingCycle: nextCycle,
                            }));
                          }}
                          className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                            isSelected
                              ? 'bg-amber-500/15 border-amber-500 text-foreground shadow-md ring-1 ring-amber-500/50'
                              : 'bg-card border-border hover:border-border/80 text-muted-foreground'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 truncate">
                                {plan.name}
                              </span>
                              {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />}
                            </div>
                            <div className="text-lg font-extrabold text-foreground font-mono">
                              ₹{(displayPrice ?? 0).toLocaleString('en-IN')}
                              <span className="text-[11px] text-muted-foreground font-normal">
                                /{effectiveCycle === 'YEARLY' ? 'yr' : 'mo'}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug line-clamp-2">
                              {plan.description || 'Complete multi-tenant management capability'}
                            </p>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-border/60 flex flex-wrap gap-1.5">
                            <Badge variant="secondary" className="text-[10px]">
                              {maxStudents > 0 ? `Up to ${maxStudents} beds` : 'Unlimited beds'}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {maxHostels > 0 ? `${maxHostels} branch${maxHostels > 1 ? 'es' : ''}` : 'Unlimited branches'}
                            </Badge>
                            {plan.trialEligible !== false ? (
                              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">
                                {plan.trialDays || 14}d Trial Eligible
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                Paid / Voucher Only
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Billing Frequency & Selected Plan Summary */}
              {selectedPlan && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-secondary/30 border border-border">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Billing Frequency</Label>
                    <div className="flex rounded-md border border-input p-1 bg-background gap-1">
                      {(['MONTHLY', 'YEARLY'] as const).map((cycle) => {
                        const isSupported =
                          !selectedPlan.allowedBillingCycles ||
                          selectedPlan.allowedBillingCycles.includes(cycle);
                        const isActiveCycle = (formData.billingCycle || 'MONTHLY') === cycle;
                        return (
                          <button
                            key={cycle}
                            type="button"
                            disabled={!isSupported}
                            onClick={() => setFormData({ ...formData, billingCycle: cycle })}
                            className={`flex-1 py-1.5 text-xs rounded font-medium transition-all ${
                              !isSupported
                                ? 'opacity-40 cursor-not-allowed text-muted-foreground'
                                : isActiveCycle
                                ? 'bg-amber-500 text-black shadow font-semibold'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {cycle === 'YEARLY' ? 'Yearly' : 'Monthly'}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Only billing intervals allowed for {selectedPlan.name} can be chosen.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Authoritative Order Preview</Label>
                    <div className="p-2.5 rounded-lg bg-background border border-border text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Selected Tier:</span>
                        <span className="font-semibold text-foreground">{selectedPlan.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Catalog Price:</span>
                        <span className="font-mono font-bold text-amber-400">
                          ₹
                          {(
                            (formData.billingCycle === 'YEARLY'
                              ? selectedPlan.priceYearly
                              : selectedPlan.priceMonthly) ?? 0
                          ).toLocaleString('en-IN')}{' '}
                          / {formData.billingCycle === 'YEARLY' ? 'yr' : 'mo'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Included Modules:</span>
                        <span className="text-foreground font-medium">
                          {selectedPlan.includedFeatures?.length || 0} modules
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 flex items-start gap-3 text-xs text-muted-foreground">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  Clicking <strong className="text-foreground">Create &amp; Proceed to Activation</strong> provisions the tenant record in <code className="text-amber-300">PENDING_PAYMENT</code> state with the exact selected plan. You will then activate via Online Payment, Voucher + PIN, or Eligible Free Trial in the next step.
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: ACTIVATE SUBSCRIPTION (ONLINE PAYMENT / VOUCHER+PIN / TRIAL / PENDING) */}
          {currentStep === 5 && provisioningResult && (
            <div className="space-y-5">
              {/* Authoritative Plan & Snapshot Banner */}
              <div className="p-4 rounded-xl bg-secondary/35 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase font-semibold tracking-wider text-amber-400">
                      {provisioningResult.subscription?.pricingSnapshot?.planName || selectedPlan?.name}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {subCycle}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {provisioningResult.subscription?.status || 'PENDING_PAYMENT'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Organization <strong>{formData.name}</strong> has been created with this plan snapshot. Choose how to activate now:
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xl font-extrabold font-mono text-foreground">
                    ₹
                    {Number(
                      provisioningResult.subscription?.pricingSnapshot?.agreedPriceRupees ??
                        provisioningResult.subscription?.agreedPriceRupees ??
                        (subCycle === 'YEARLY' ? selectedPlan?.priceYearly : selectedPlan?.priceMonthly) ??
                        0
                    ).toLocaleString('en-IN')}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    per {subCycle === 'YEARLY' ? 'year' : 'month'}
                  </span>
                </div>
              </div>

              {activationError && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-xs text-destructive flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{activationError}</span>
                </div>
              )}

              {/* Activation Option Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActivationMethodTab('ONLINE');
                    setActivationError(null);
                  }}
                  className={`p-3 rounded-xl border text-left text-xs transition-all ${
                    activationMethodTab === 'ONLINE'
                      ? 'border-amber-500 bg-amber-500/15 text-foreground font-semibold'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-amber-400 mb-1" />
                  <div>Online Payment</div>
                  <div className="text-[10px] opacity-80 font-normal">Verified Razorpay checkout</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActivationMethodTab('VOUCHER');
                    setActivationError(null);
                  }}
                  className={`p-3 rounded-xl border text-left text-xs transition-all ${
                    activationMethodTab === 'VOUCHER'
                      ? 'border-purple-500 bg-purple-500/15 text-foreground font-semibold'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Ticket className="w-4 h-4 text-purple-400 mb-1" />
                  <div>Voucher Code &amp; PIN</div>
                  <div className="text-[10px] opacity-80 font-normal">Discount, activation, or trial</div>
                </button>

                <button
                  type="button"
                  disabled={selectedPlan?.trialEligible === false}
                  onClick={() => {
                    setActivationMethodTab('TRIAL');
                    setActivationError(null);
                  }}
                  className={`p-3 rounded-xl border text-left text-xs transition-all ${
                    selectedPlan?.trialEligible === false
                      ? 'border-border/50 bg-muted/20 text-muted-foreground opacity-50 cursor-not-allowed'
                      : activationMethodTab === 'TRIAL'
                      ? 'border-emerald-500 bg-emerald-500/15 text-foreground font-semibold'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Clock className="w-4 h-4 text-emerald-400 mb-1" />
                  <div>Free Trial</div>
                  <div className="text-[10px] opacity-80 font-normal">
                    {selectedPlan?.trialEligible === false
                      ? 'Not eligible on this plan'
                      : `${selectedPlan?.trialDays || 14}-day pilot activation`}
                  </div>
                </button>
              </div>

              {/* Panel A: Online Payment */}
              {activationMethodTab === 'ONLINE' && (
                <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-4">
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-semibold text-foreground text-sm">Pay via Razorpay Checkout</p>
                    <p>
                      Initializes a verified payment order for{' '}
                      <strong>{provisioningResult.subscription?.pricingSnapshot?.planName || selectedPlan?.name}</strong>.
                      Subscription status becomes <strong>ACTIVE</strong> only after cryptographic signature verification succeeds.
                    </p>
                  </div>
                  <Button
                    type="button"
                    disabled={isActivating}
                    onClick={handleOnlinePaymentActivation}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs h-10"
                  >
                    {isActivating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Opening Razorpay Checkout...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4 mr-2" />
                        Pay ₹
                        {Number(
                          provisioningResult.subscription?.pricingSnapshot?.agreedPriceRupees ??
                            provisioningResult.subscription?.agreedPriceRupees ??
                            0
                        ).toLocaleString('en-IN')}{' '}
                        Now &amp; Activate
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Panel B: Voucher + PIN */}
              {activationMethodTab === 'VOUCHER' && (
                <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">16-Char Voucher Code</Label>
                      <Input
                        placeholder="e.g. Q2M7K9X4P8W3R6TZ"
                        value={voucherCode}
                        onChange={(e) => {
                          setVoucherCode(e.target.value.toUpperCase());
                          setVoucherError(null);
                          setVoucherPreview(null);
                        }}
                        className="h-9 text-xs font-mono uppercase"
                        maxLength={19}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">6-Digit Secret PIN</Label>
                      <div className="relative">
                        <Input
                          type={isPinVisible ? 'text' : 'password'}
                          placeholder="6-digit PIN"
                          value={voucherPin}
                          onChange={(e) => {
                            setVoucherPin(e.target.value);
                            setVoucherError(null);
                            setVoucherPreview(null);
                          }}
                          className="h-9 text-xs font-mono pr-8"
                          maxLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setIsPinVisible(!isPinVisible)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {isPinVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {voucherError && (
                    <p className="text-xs text-destructive flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {voucherError}
                    </p>
                  )}

                  {!voucherPreview ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isPreviewingVoucher || !voucherCode.trim() || !voucherPin.trim()}
                      onClick={handlePreviewVoucher}
                      className="w-full h-9 text-xs font-semibold"
                    >
                      {isPreviewingVoucher ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Verifying Voucher...
                        </>
                      ) : (
                        <>
                          <Tag className="w-3.5 h-3.5 mr-1.5" /> Verify &amp; Preview Benefit
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-emerald-400">{voucherPreview.voucherName}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {voucherPreview.voucherReference} • {voucherPreview.voucherType || 'DISCOUNT'}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setVoucherPreview(null)}
                          className="h-7 text-xs"
                        >
                          Change
                        </Button>
                      </div>
                      {voucherPreview.benefitSummary && (
                        <p className="text-foreground font-medium">{voucherPreview.benefitSummary}</p>
                      )}
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-500/20">
                        <div>
                          <span className="text-muted-foreground block">Original</span>
                          <span className="font-mono font-semibold">₹{voucherPreview.originalAmount.toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Discount</span>
                          <span className="font-mono font-semibold text-emerald-400">
                            -₹{voucherPreview.discountAmount.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Payable</span>
                          <span className="font-mono font-bold text-foreground">
                            ₹{voucherPreview.finalPayable.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        disabled={isActivating}
                        onClick={handleConfirmVoucherRedemption}
                        className="w-full h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
                      >
                        {isActivating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Processing...
                          </>
                        ) : voucherPreview.isZeroPayable ? (
                          voucherPreview.voucherType === 'TRIAL'
                            ? `Confirm & Activate ${voucherPreview.trialDaysGranted || 14}-Day Trial`
                            : 'Confirm & Activate Subscription (₹0)'
                        ) : (
                          `Pay Remaining ₹${voucherPreview.finalPayable.toLocaleString('en-IN')} via Razorpay`
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Panel C: Free Trial */}
              {activationMethodTab === 'TRIAL' && selectedPlan?.trialEligible !== false && (
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-3 text-xs">
                  <div className="font-semibold text-sm text-foreground">
                    Activate {selectedPlan?.trialDays || 14}-Day Free Trial on {selectedPlan?.name}
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Starts the tenant immediately in <strong>TRIAL</strong> status with{' '}
                    <strong>{selectedPlan?.includedFeatures?.length || 0}</strong> plan features enabled for{' '}
                    <strong>{selectedPlan?.trialDays || 14} days</strong>. No fake payment or invoice is recorded.
                  </p>
                  <Button
                    type="button"
                    disabled={isActivating}
                    onClick={handleStartFreeTrialActivation}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs h-10"
                  >
                    {isActivating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Activating Trial...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Activate {selectedPlan?.trialDays || 14}-Day Free Trial
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* STEP 6: PROVISIONING SUMMARY & INVITATION STATUS */}
          {currentStep === 6 && provisioningResult && (
            <div className="space-y-4">
              {/* Success Banner */}
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-semibold text-foreground text-sm">
                    Hostel Onboarded &amp; Accounts Provisioned Successfully!
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    The organization, authoritative subscription snapshot, and single-use invitation links have been saved cleanly.
                  </p>
                </div>
              </div>

              {/* Subscription Summary Card */}
              <div className="p-4 rounded-xl border border-border bg-card/60 space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-amber-400" />
                    <span className="font-semibold text-sm text-foreground">Subscription &amp; Plan Assignment</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className={
                        provisioningResult.subscription?.status === 'ACTIVE'
                          ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-xs'
                          : provisioningResult.subscription?.status === 'TRIAL'
                          ? 'border-blue-500/40 text-blue-400 bg-blue-500/10 text-xs'
                          : 'border-amber-500/40 text-amber-400 bg-amber-500/10 text-xs'
                      }
                    >
                      {provisioningResult.subscription?.status || 'PENDING_PAYMENT'}
                    </Badge>
                    {provisioningResult.subscription?.activationMethod && (
                      <Badge variant="secondary" className="text-[10px]">
                        {String(provisioningResult.subscription.activationMethod).replace('_', ' ')}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block">Assigned Plan</span>
                    <span className="font-semibold text-foreground">
                      {provisioningResult.subscription?.pricingSnapshot?.planName || selectedPlan?.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Agreed Price</span>
                    <span className="font-mono font-semibold text-foreground flex items-center">
                      <IndianRupee className="w-3 h-3 mr-0.5 inline text-amber-400" />
                      {Number(
                        provisioningResult.subscription?.pricingSnapshot?.agreedPriceRupees ??
                          provisioningResult.subscription?.agreedPriceRupees ??
                          0
                      ).toLocaleString('en-IN')}{' '}
                      / {subCycle === 'YEARLY' ? 'yr' : 'mo'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">
                      {provisioningResult.subscription?.status === 'TRIAL' ? 'Trial Ends' : 'Period End'}
                    </span>
                    <span className="font-mono text-foreground">
                      {provisioningResult.subscription?.trialEndsAt &&
                      provisioningResult.subscription?.status === 'TRIAL'
                        ? new Date(provisioningResult.subscription.trialEndsAt).toLocaleDateString('en-IN')
                        : provisioningResult.subscription?.currentPeriodEnd
                        ? new Date(provisioningResult.subscription.currentPeriodEnd).toLocaleDateString('en-IN')
                        : 'Pending Activation'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Reference</span>
                    <span className="font-mono text-foreground truncate block">
                      {activationMeta?.invoiceNumber ||
                        activationMeta?.voucherReference ||
                        provisioningResult.subscription?.lastVoucherReference ||
                        'Onboarding'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Partial Failure Warning Banner if any email failed */}
              {(provisioningResult.adminAccount?.invitationEmailStatus === 'failed' ||
                provisioningResult.wardenAccount?.invitationEmailStatus === 'failed') && (
                <div className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-200 leading-relaxed">
                    <strong className="text-amber-300">Action Needed:</strong> One or more invitation emails could not be confirmed by the mail server. You can safely retry sending the invitation at any time using the <em>Resend Invitation</em> buttons below.
                  </div>
                </div>
              )}

              {/* Grid 1: Hostel Details */}
              <div className="p-4 rounded-xl border border-border bg-card/60 space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-amber-400" />
                    <span className="font-semibold text-sm text-foreground">Hostel Branch Record</span>
                  </div>
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-xs">
                    {provisioningResult.hostel?.status || 'ACTIVE'}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block">Hostel Name</span>
                    <span className="font-semibold text-foreground">{provisioningResult.hostel?.name || formData.branchName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Branch Code</span>
                    <span className="font-mono font-semibold text-foreground">{provisioningResult.hostel?.code || formData.branchCode}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Bed Capacity</span>
                    <span className="font-semibold text-foreground">{provisioningResult.hostel?.capacity || formData.capacity} Beds</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Gender Scoping</span>
                    <span className="font-semibold text-foreground">{provisioningResult.hostel?.genderType || formData.genderType}</span>
                  </div>
                </div>
              </div>

              {/* Grid 2: Hostel Admin Account */}
              <div className="p-4 rounded-xl border border-border bg-card/60 space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-blue-400" />
                    <span className="font-semibold text-sm text-foreground">Hostel Administrator Account</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      Status: {provisioningResult.adminAccount?.status === 'ACTIVE' ? 'ACTIVE (Accepted)' : 'INVITED (Pending Activation)'}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block">Administrator Name</span>
                    <span className="font-semibold text-foreground">{provisioningResult.adminAccount?.name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Login Email</span>
                    <span className="font-mono text-foreground">{provisioningResult.adminAccount?.email}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Username</span>
                    <span className="font-mono text-foreground">{provisioningResult.adminAccount?.username}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Welcome Email Status:</span>
                    {provisioningResult.adminAccount?.invitationEmailStatus === 'sent' ? (
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
                        Sent (Activation Link Emailed)
                      </Badge>
                    ) : provisioningResult.adminAccount?.invitationEmailStatus === 'failed' ? (
                      <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-xs">
                        Delivery Failed
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Queued</Badge>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResendAdminInvite}
                    disabled={isResendingAdmin}
                    className="h-7 text-xs gap-1 border-amber-500/30 hover:border-amber-500/60"
                  >
                    {isResendingAdmin ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Resend Welcome Email
                  </Button>
                </div>
              </div>

              {/* Grid 3: Warden Account */}
              <div className="p-4 rounded-xl border border-border bg-card/60 space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-purple-400" />
                    <span className="font-semibold text-sm text-foreground">Warden Account</span>
                  </div>
                  {provisioningResult.wardenAccount ? (
                    <Badge variant="outline" className="text-xs">
                      Status: {provisioningResult.wardenAccount.status === 'ACTIVE' ? 'ACTIVE (Accepted)' : 'INVITED (Pending Activation)'}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      Not Provisioned
                    </Badge>
                  )}
                </div>

                {provisioningResult.wardenAccount ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground block">Warden Name</span>
                        <span className="font-semibold text-foreground">{provisioningResult.wardenAccount.name}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Login Email / ID</span>
                        <span className="font-mono text-foreground">{provisioningResult.wardenAccount.email}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Username</span>
                        <span className="font-mono text-foreground">{provisioningResult.wardenAccount.username}</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20 text-xs text-muted-foreground flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>
                        Warden invitation and activation link were addressed to the Hostel Admin (<strong>{provisioningResult.adminAccount?.email}</strong>) to forward to the Warden.
                      </span>
                    </div>

                    <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Invitation Status:</span>
                        {provisioningResult.wardenAccount.invitationEmailStatus === 'sent' ? (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
                            Sent to Admin for Forwarding
                          </Badge>
                        ) : provisioningResult.wardenAccount.invitationEmailStatus === 'failed' ? (
                          <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-xs">
                            Delivery Failed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Queued</Badge>
                        )}
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleResendWardenInvite}
                        disabled={isResendingWarden}
                        className="h-7 text-xs gap-1 border-purple-500/30 hover:border-purple-500/60"
                      >
                        {isResendingWarden ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Resend Warden Invitation
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground py-2 leading-relaxed">
                    Warden details were not provided during onboarding. You can provision a dedicated Warden account at any time through the Hostel branch settings in the Super Admin console.
                  </div>
                )}
              </div>

              {/* Security Banner */}
              <div className="p-3 rounded-lg bg-secondary/30 border border-border/40 text-xs text-muted-foreground flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  <strong>Zero-Trust Credential Security:</strong> No plaintext passwords were sent or displayed. Staff members establish their own confidential passwords upon opening their single-use expiring activation links.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border/80 bg-card/60 flex items-center justify-between">
          <div>
            {currentStep === 6 ? (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> All records and security tokens stored safely
              </span>
            ) : currentStep === 5 ? (
              <span className="text-xs text-muted-foreground">
                Tenant created in database &bull; Choose an activation option or finish pending
              </span>
            ) : (
              currentStep > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleBack}
                  disabled={isSubmitting}
                  className="gap-1 text-xs"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </Button>
              )
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentStep === 6 ? (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onClose();
                  setCurrentStep(1);
                  setProvisioningResult(null);
                  resetActivationState();
                }}
                className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs gap-1.5 shadow"
              >
                <CheckCircle2 className="w-4 h-4" /> Done &amp; Close
              </Button>
            ) : currentStep === 5 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isActivating}
                onClick={() => setCurrentStep(6)}
                className="text-xs gap-1"
              >
                Finish as Pending Payment <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="text-xs"
                >
                  Cancel
                </Button>

                {currentStep < 4 ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleNext}
                    className="bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs gap-1"
                  >
                    Next Step <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateTenantAndProceed}
                    disabled={isSubmitting || !selectedPlan}
                    className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs gap-1.5 shadow-lg shadow-emerald-500/20"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Provisioning Tenant...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> Create &amp; Proceed to Activation
                      </>
                    )}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
