import { useState, useRef } from 'react';
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
} from 'lucide-react';
import { superAdminService } from '@/services/api/superAdmin.service';
import { api } from '@/lib/api';
import { HostelAmenity, HostelGenderType, OnboardTenantPayload } from '@/types';
import { toast } from 'react-toastify';

interface OnboardTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const AMENITY_CONFIG: Array<{ value: HostelAmenity; label: string; icon: any }> = [
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

const PLAN_OPTIONS = [
  {
    code: 'STARTER',
    name: 'Starter Plan',
    beds: 'Up to 100 beds',
    price: '₹4,999/mo',
    desc: 'Perfect for standalone hostels & boutique student PGs.',
    badge: 'Popular for Single Hostels',
  },
  {
    code: 'GROWTH',
    name: 'Growth Plan',
    beds: 'Up to 250 beds',
    price: '₹9,999/mo',
    desc: 'Automated recurring billing, laundry slots, and cashflow analyzer.',
    badge: 'Multi-Branch Ready',
  },
  {
    code: 'ENTERPRISE',
    name: 'Enterprise Plan',
    beds: 'Unlimited beds',
    price: '₹19,999/mo',
    desc: 'Custom domain, white-label branding, biometric API, and priority support.',
    badge: 'High Scale Chains',
  },
];

export function OnboardTenantModal({ isOpen, onClose, onSuccess }: OnboardTenantModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAadhaar, setIsUploadingAadhaar] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    // Stage 4: Subscription & Policies
    planCode: 'STARTER',
    billingCycle: 'MONTHLY',
    trialDays: 14,
    monthlyRentDueDay: 5,
    gracePeriodDays: 5,
    lateFeePerDay: 50,
    securityDeposit: 5000,
    hasMess: true,
    messOffNoticeHours: 24,
    messRebatePerDay: 120,
    laundrySlotsPerWeek: 2,
    curfewTime: '21:30',
    parentConsentRequired: true,
  });

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
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to upload document');
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

    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // Final Submission
  const handleSubmit = async () => {
    if (!validateStep(4)) return;

    try {
      setIsSubmitting(true);
      const res = await superAdminService.createOrganization(formData);
      if (res.success) {
        toast.success(`🎉 Organization '${formData.name}' onboarded successfully!`);
        onSuccess?.();
        onClose();
        setCurrentStep(1);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to onboard organization');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
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
                    Hostel Organization Onboarding
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Stage-by-stage real-world tenant setup with KYC, property branch, administrator, and policies.
                  </DialogDescription>
                </div>
              </div>
              <Badge variant="outline" className="border-amber-500/30 text-amber-400 font-mono text-xs px-3 py-1">
                Step {currentStep} of 4
              </Badge>
            </div>
          </DialogHeader>

          {/* Stepper Progress Bar */}
          <div className="grid grid-cols-4 gap-2 mt-5">
            {[
              { num: 1, label: 'KYC & Entity', icon: Building2 },
              { num: 2, label: 'Property & Amenities', icon: GitFork },
              { num: 3, label: 'Admin Account', icon: UserCheck },
              { num: 4, label: 'Plan & Policies', icon: CreditCard },
            ].map((step) => {
              const isPassed = currentStep > step.num;
              const isCurrent = currentStep === step.num;

              return (
                <div
                  key={step.num}
                  className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                    isCurrent
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 font-semibold'
                      : isPassed
                      ? 'bg-secondary/60 border-border text-foreground'
                      : 'bg-transparent border-transparent text-muted-foreground opacity-60'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
                      isPassed
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : isCurrent
                        ? 'bg-amber-500 text-black font-bold'
                        : 'bg-secondary text-muted-foreground'
                    }`}
                  >
                    {isPassed ? <CheckCircle2 className="w-3.5 h-3.5" /> : step.num}
                  </div>
                  <span className="text-xs truncate hidden sm:inline">{step.label}</span>
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

          {/* STEP 4: SUBSCRIPTION & OPERATIONAL POLICIES */}
          {currentStep === 4 && (
            <div className="space-y-5">
              {/* Plan Selection Cards */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground">SaaS Subscription Tier</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {PLAN_OPTIONS.map((plan) => {
                    const isSelected = formData.planCode === plan.code;

                    return (
                      <div
                        key={plan.code}
                        onClick={() => setFormData({ ...formData, planCode: plan.code })}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500 text-foreground shadow-md'
                            : 'bg-card border-border hover:border-border/80 text-muted-foreground'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                              {plan.name}
                            </span>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                          </div>
                          <div className="text-base font-bold text-foreground">{plan.price}</div>
                          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{plan.desc}</p>
                        </div>
                        <Badge variant="secondary" className="mt-3 text-[10px] w-fit">
                          {plan.beds}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Billing Cycle & Trial */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-secondary/30 border border-border">
                <div className="space-y-1.5">
                  <Label>Billing Frequency</Label>
                  <div className="flex rounded-md border border-input p-1 bg-background">
                    {(['MONTHLY', 'QUARTERLY', 'ANNUAL'] as const).map((cycle) => (
                      <button
                        key={cycle}
                        type="button"
                        onClick={() => setFormData({ ...formData, billingCycle: cycle })}
                        className={`flex-1 py-1 text-xs rounded font-medium transition-all ${
                          formData.billingCycle === cycle
                            ? 'bg-amber-500 text-black shadow'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {cycle === 'ANNUAL' ? 'Annual (15% Off)' : cycle}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="trialDays">Trial Duration</Label>
                  <select
                    id="trialDays"
                    className="w-full h-9 px-3 bg-background border border-input rounded-md text-xs text-foreground focus:outline-none"
                    value={formData.trialDays}
                    onChange={(e) => setFormData({ ...formData, trialDays: Number(e.target.value) })}
                  >
                    <option value={14}>14 Days Free Trial</option>
                    <option value={30}>30 Days Extended Trial</option>
                    <option value={0}>Immediate Active Subscription</option>
                  </select>
                </div>
              </div>

              {/* Living Operations & Policies */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-foreground">
                  Living Operations & Rules Configuration
                </Label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="graceDays" className="text-xs">Grace Period (Days)</Label>
                    <Input
                      id="graceDays"
                      type="number"
                      className="h-8 text-xs"
                      value={formData.gracePeriodDays}
                      onChange={(e) => setFormData({ ...formData, gracePeriodDays: Number(e.target.value) })}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="lateFee" className="text-xs">Late Fee / Day (₹)</Label>
                    <Input
                      id="lateFee"
                      type="number"
                      className="h-8 text-xs"
                      value={formData.lateFeePerDay}
                      onChange={(e) => setFormData({ ...formData, lateFeePerDay: Number(e.target.value) })}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="deposit" className="text-xs">Security Deposit (₹)</Label>
                    <Input
                      id="deposit"
                      type="number"
                      className="h-8 text-xs"
                      value={formData.securityDeposit}
                      onChange={(e) => setFormData({ ...formData, securityDeposit: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <Label htmlFor="curfew" className="text-xs">Night Curfew Timing</Label>
                    <Input
                      id="curfew"
                      type="time"
                      className="h-8 text-xs"
                      value={formData.curfewTime}
                      onChange={(e) => setFormData({ ...formData, curfewTime: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="laundrySlots" className="text-xs">Weekly Laundry Slots</Label>
                    <Input
                      id="laundrySlots"
                      type="number"
                      className="h-8 text-xs"
                      value={formData.laundrySlotsPerWeek}
                      onChange={(e) => setFormData({ ...formData, laundrySlotsPerWeek: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border/80 bg-card/60 flex items-center justify-between">
          <div>
            {currentStep > 1 && (
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
            )}
          </div>

          <div className="flex items-center gap-2">
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
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs gap-1.5 shadow-lg shadow-emerald-500/20"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Provisioning Tenant...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Complete Onboarding
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
