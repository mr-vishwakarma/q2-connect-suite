import { useEffect, useState, useMemo } from 'react';
import {
  CreditCard,
  Check,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Sparkles,
  RefreshCw,
  Search,
  Building,
  Users,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  DollarSign,
  ShieldAlert,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { superAdminService } from '@/services/api/superAdmin.service';
import { billingService } from '@/services/api/billing.service';
import { SubscriptionPlan, FeatureDefinition } from '@/types';
import { toast } from 'react-toastify';
import { getErrorMessage } from '@/utils/errorHandling';

const STANDARD_FEATURE_OPTIONS: { key: string; label: string }[] = [
  { key: 'student_management', label: 'Student Management' },
  { key: 'room_management', label: 'Room & Bed Management' },
  { key: 'fee_management', label: 'Fee Collection & Matrix' },
  { key: 'security_deposit', label: 'Security Deposits' },
  { key: 'expense_management', label: 'Expense Tracker' },
  { key: 'attendance', label: 'Attendance & Gate Passes' },
  { key: 'mess_management', label: 'Mess & Leave Requests' },
  { key: 'laundry', label: 'Laundry Booking' },
  { key: 'complaints', label: 'Complaints & Suggestions' },
  { key: 'reports', label: 'Financial & Occupancy Reports' },
  { key: 'advanced_analytics', label: 'Advanced Analytics & AI' },
  { key: 'custom_branding', label: 'White-label & Custom Branding' },
  { key: 'biometric_integration', label: 'Biometric Attendance Hardware' },
  { key: 'api_access', label: 'External API & Webhooks' },
];

export default function PlanManagement() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [featuresList, setFeaturesList] = useState<FeatureDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'archived'>('all');
  const [isSeeding, setIsSeeding] = useState(false);

  // Dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<SubscriptionPlan | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    priceMonthly: 0,
    priceYearly: 0,
    allowedBillingCycles: ['MONTHLY', 'YEARLY'] as ('MONTHLY' | 'YEARLY')[],
    trialEligible: true,
    trialDays: 14,
    sortOrder: 1,
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'ARCHIVED',
    isPopular: false,
    isActive: true,
    maxStudents: 100,
    maxRooms: 50,
    maxHostels: 1,
    maxStaff: 5,
    storageGb: 5,
    includedFeatures: [] as string[],
  });

  useEffect(() => {
    fetchPlans();
    fetchFeatures();
  }, []);

  const fetchPlans = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await superAdminService.getPlans();
      if (res.success && res.data) {
        setPlans(res.data);
      } else {
        setPlans([]);
      }
    } catch (err: unknown) {
      console.error('Failed to fetch plans:', err);
      setError(getErrorMessage(err, 'Failed to load subscription plans'));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFeatures = async () => {
    try {
      const res = await superAdminService.getFeatures();
      if (res.success && res.data && res.data.length > 0) {
        setFeaturesList(res.data);
      }
    } catch (err) {
      console.warn('Could not fetch feature catalog for plan checklist:', err);
    }
  };

  const availableFeatures = useMemo(() => {
    if (featuresList.length > 0) {
      return featuresList.map((f) => ({ key: f.key, label: f.name }));
    }
    return STANDARD_FEATURE_OPTIONS;
  }, [featuresList]);

  const handleSeedDefaults = async () => {
    try {
      setIsSeeding(true);
      const res = await superAdminService.seedDefaultPlans();
      if (res.success && res.data) {
        billingService.invalidatePlansCache();
        setPlans(res.data);
        toast.success(`Standard pricing tiers initialized (${res.data.length} plans)`);
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to initialize default plans'));
    } finally {
      setIsSeeding(false);
    }
  };

  const handleOpenCreate = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      priceMonthly: 2999,
      priceYearly: 29990,
      allowedBillingCycles: ['MONTHLY', 'YEARLY'],
      trialEligible: true,
      trialDays: 14,
      sortOrder: plans.length + 1,
      status: 'ACTIVE',
      isPopular: false,
      isActive: true,
      maxStudents: 100,
      maxRooms: 40,
      maxHostels: 1,
      maxStaff: 5,
      storageGb: 5,
      includedFeatures: [
        'student_management',
        'room_management',
        'fee_management',
        'security_deposit',
        'attendance',
        'complaints',
        'reports',
      ],
    });
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    const derivedStatus: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' =
      plan.status || (plan.isActive === false ? 'INACTIVE' : 'ACTIVE');
    setFormData({
      name: plan.name || '',
      code: plan.code || '',
      description: plan.description || '',
      priceMonthly: plan.priceMonthly || 0,
      priceYearly: plan.priceYearly || 0,
      allowedBillingCycles:
        plan.allowedBillingCycles && plan.allowedBillingCycles.length > 0
          ? plan.allowedBillingCycles
          : ['MONTHLY', 'YEARLY'],
      trialEligible: plan.trialEligible ?? true,
      trialDays: plan.trialDays ?? 14,
      sortOrder: plan.sortOrder ?? 1,
      status: derivedStatus,
      isPopular: plan.isPopular || false,
      isActive: derivedStatus === 'ACTIVE',
      maxStudents: plan.limits?.maxStudents ?? 0,
      maxRooms: plan.limits?.maxRooms ?? 50,
      maxHostels: plan.limits?.maxHostels ?? 1,
      maxStaff: plan.limits?.maxStaff ?? 5,
      storageGb: plan.limits?.storageGb ?? 5,
      includedFeatures: plan.includedFeatures || [],
    });
  };

  const handleToggleCycleCheck = (cycle: 'MONTHLY' | 'YEARLY') => {
    setFormData((prev) => {
      const exists = prev.allowedBillingCycles.includes(cycle);
      const next = exists
        ? prev.allowedBillingCycles.filter((c) => c !== cycle)
        : [...prev.allowedBillingCycles, cycle];
      return {
        ...prev,
        allowedBillingCycles: next.length > 0 ? next : [cycle],
      };
    });
  };

  const handleToggleFeatureCheck = (featureKey: string) => {
    setFormData((prev) => {
      const exists = prev.includedFeatures.includes(featureKey);
      return {
        ...prev,
        includedFeatures: exists
          ? prev.includedFeatures.filter((k) => k !== featureKey)
          : [...prev.includedFeatures, featureKey],
      };
    });
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.allowedBillingCycles || formData.allowedBillingCycles.length === 0) {
      toast.error('Select at least one billing cycle (Monthly or Yearly)');
      return;
    }

    try {
      setIsSaving(true);
      const payload: Partial<SubscriptionPlan> = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        priceMonthly: Number(formData.priceMonthly),
        priceYearly: Number(formData.priceYearly),
        allowedBillingCycles: formData.allowedBillingCycles,
        trialEligible: Boolean(formData.trialEligible),
        trialDays: formData.trialEligible ? Math.max(0, Number(formData.trialDays) || 14) : 0,
        sortOrder: Number(formData.sortOrder) || 1,
        status: formData.status,
        isPopular: formData.isPopular,
        isActive: formData.status === 'ACTIVE',
        limits: {
          maxStudents: Number(formData.maxStudents),
          maxRooms: Number(formData.maxRooms),
          maxHostels: Number(formData.maxHostels),
          maxStaff: Number(formData.maxStaff),
          storageGb: Number(formData.storageGb),
        },
        includedFeatures: formData.includedFeatures as SubscriptionPlan['includedFeatures'],
      };

      if (editingPlan) {
        const planId = editingPlan._id || editingPlan.id;
        const res = await superAdminService.updatePlan(planId, payload);
        if (res.success) {
          billingService.invalidatePlansCache();
          toast.success(`Plan '${formData.name}' updated successfully`);
          setEditingPlan(null);
          fetchPlans();
        }
      } else {
        payload.code = (formData.code || formData.name)
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, '_') as SubscriptionPlan['code'];
        const res = await superAdminService.createPlan(payload);
        if (res.success) {
          billingService.invalidatePlansCache();
          toast.success(`Plan '${formData.name}' created successfully`);
          setIsCreateOpen(false);
          fetchPlans();
        }
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to save subscription plan'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!deletingPlan) return;
    const planId = deletingPlan._id || deletingPlan.id;
    try {
      setIsSaving(true);
      await superAdminService.deletePlan(planId);
      billingService.invalidatePlansCache();
      toast.success(`Plan '${deletingPlan.name}' removed or archived from catalog`);
      setDeletingPlan(null);
      fetchPlans();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to delete plan'));
    } finally {
      setIsSaving(false);
    }
  };

  const filteredPlans = useMemo(() => {
    return plans.filter((plan) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        plan.name.toLowerCase().includes(q) ||
        (plan.code && plan.code.toLowerCase().includes(q)) ||
        (plan.description && plan.description.toLowerCase().includes(q));

      const effectiveStatus = plan.status || (plan.isActive === false ? 'INACTIVE' : 'ACTIVE');
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && effectiveStatus === 'ACTIVE' && plan.isActive !== false) ||
        (statusFilter === 'inactive' && (effectiveStatus === 'INACTIVE' || plan.isActive === false)) ||
        (statusFilter === 'archived' && effectiveStatus === 'ARCHIVED');

      return matchesSearch && matchesStatus;
    });
  }, [plans, searchQuery, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Subscription Plans & Pricing</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Manage SaaS pricing tiers, tenant capacity quotas, feature entitlements, and billing definitions.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPlans}
            disabled={isLoading}
            className="h-9 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="h-9 text-xs bg-amber-500 hover:bg-amber-600 text-black font-semibold"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Create Plan
          </Button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3.5 rounded-xl bg-card border border-border/60">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Total Tiers</span>
          <span className="text-lg sm:text-xl font-bold text-foreground mt-0.5 block">{plans.length}</span>
        </div>
        <div className="p-3.5 rounded-xl bg-card border border-border/60">
          <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider block">Active For Billing</span>
          <span className="text-lg sm:text-xl font-bold text-emerald-400 mt-0.5 block">
            {plans.filter((p) => p.isActive !== false).length}
          </span>
        </div>
        <div className="p-3.5 rounded-xl bg-card border border-border/60">
          <span className="text-[11px] font-medium text-amber-400 uppercase tracking-wider block">Highlighted Tier</span>
          <span className="text-sm sm:text-base font-bold text-amber-400 mt-1 block truncate">
            {plans.find((p) => p.isPopular)?.name || 'None Selected'}
          </span>
        </div>
        <div className="p-3.5 rounded-xl bg-card border border-border/60">
          <span className="text-[11px] font-medium text-purple-400 uppercase tracking-wider block">Standard Modules</span>
          <span className="text-lg sm:text-xl font-bold text-purple-400 mt-0.5 block">{availableFeatures.length}</span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border/60">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search plans by name, code or description..."
            className="pl-9 h-9 text-xs bg-background/50 border-border/70"
          />
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          {(['all', 'active', 'inactive', 'archived'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                statusFilter === st
                  ? 'bg-amber-500 text-black font-semibold shadow-sm'
                  : 'bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-between gap-3 text-destructive">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span className="text-xs sm:text-sm font-medium">{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchPlans} className="text-xs h-8">
            Retry
          </Button>
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((idx) => (
            <div key={idx} className="p-6 rounded-2xl bg-card border border-border/60 animate-pulse space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-6 bg-muted rounded w-1/3" />
                <div className="h-5 bg-muted rounded w-20" />
              </div>
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-10 bg-muted rounded w-1/2" />
              <div className="space-y-2 pt-4">
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-4 bg-muted rounded w-5/6" />
                <div className="h-4 bg-muted rounded w-4/6" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredPlans.length === 0 ? (
        /* Empty State */
        <div className="text-center py-16 px-4 border border-dashed border-border/80 rounded-2xl bg-card/40">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3">
            <CreditCard className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            {plans.length === 0 ? 'No Subscription Plans Configured' : 'No Matching Plans Found'}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            {plans.length === 0
              ? 'No subscription plans have been initialized yet. Seed the default SaaS packages (Starter, Growth, Professional, Enterprise) to enable tenant billing.'
              : `No subscription plans match your search "${searchQuery}".`}
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {plans.length === 0 ? (
              <Button
                onClick={handleSeedDefaults}
                disabled={isSeeding}
                className="bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs h-9"
              >
                {isSeeding ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Initializing Pricing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Initialize Standard Plan Catalog
                  </>
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                className="text-xs"
              >
                Clear Filters
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleOpenCreate} className="text-xs">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Create Custom Plan
            </Button>
          </div>
        </div>
      ) : (
        /* Plan Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlans.map((plan) => {
            const planId = plan._id || plan.id;
            const maxStudents = plan.limits?.maxStudents;
            const maxRooms = plan.limits?.maxRooms;
            const maxHostels = plan.limits?.maxHostels;
            const storageGb = plan.limits?.storageGb;

            return (
              <Card
                key={planId}
                className={`border flex flex-col justify-between transition-all duration-200 relative ${
                  plan.isPopular
                    ? 'border-amber-500/70 shadow-lg shadow-amber-500/5 bg-gradient-to-b from-card via-card to-amber-500/5'
                    : 'border-border/60 bg-card hover:border-border'
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-lg font-bold text-foreground">{plan.name}</CardTitle>
                      {plan.code && (
                        <Badge variant="outline" className="text-[10px] font-mono uppercase bg-secondary/40 text-muted-foreground border-border">
                          {plan.code}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase ${
                          (plan.status || (plan.isActive ? 'ACTIVE' : 'INACTIVE')) === 'ACTIVE'
                            ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                            : (plan.status === 'ARCHIVED')
                            ? 'border-zinc-500/30 text-zinc-400 bg-zinc-500/10'
                            : 'border-amber-500/30 text-amber-400 bg-amber-500/10'
                        }`}
                      >
                        {plan.status || (plan.isActive ? 'ACTIVE' : 'INACTIVE')}
                      </Badge>
                    </div>
                    {plan.isPopular && (
                      <Badge className="bg-amber-500 text-black font-bold text-[10px] shrink-0">
                        MOST POPULAR
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 min-h-[32px]">
                    {plan.description || 'General subscription tier.'}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {(plan.allowedBillingCycles?.length ? plan.allowedBillingCycles : ['MONTHLY', 'YEARLY']).map((cy) => (
                      <Badge key={cy} variant="outline" className="text-[10px] font-mono py-0 px-1.5">
                        {cy}
                      </Badge>
                    ))}
                    {plan.trialEligible !== false ? (
                      <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-[10px] py-0 px-1.5">
                        {plan.trialDays || 14}d Free Trial
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground py-0 px-1.5">
                        Paid Only
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] text-muted-foreground py-0 px-1.5 font-mono">
                      v{plan.version || 1}
                    </Badge>
                  </div>

                  <div className="pt-3 flex items-baseline justify-between border-t border-border/40 mt-2">
                    <div>
                      <span className="text-2xl sm:text-3xl font-black text-foreground">
                        ₹{plan.priceMonthly?.toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-muted-foreground"> / month</span>
                    </div>
                    {plan.priceYearly ? (
                      <div className="text-right">
                        <span className="text-xs text-emerald-400 font-mono font-semibold block">
                          ₹{plan.priceYearly?.toLocaleString('en-IN')} / yr
                        </span>
                        <span className="text-[10px] text-muted-foreground">Billed annually</span>
                      </div>
                    ) : null}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-1">
                  {/* Capacity Bounds */}
                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-secondary/30 border border-border/50 text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Max Students</span>
                      <span className="font-semibold text-foreground">
                        {maxStudents === 0 || maxStudents === null ? 'Unlimited' : `${maxStudents} residents`}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Max Rooms</span>
                      <span className="font-semibold text-foreground">
                        {maxRooms === 0 || maxRooms === null ? 'Unlimited' : `${maxRooms} rooms`}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Max Hostels</span>
                      <span className="font-semibold text-foreground">
                        {maxHostels === 0 || maxHostels === null ? 'Unlimited' : `${maxHostels} property`}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Cloud Storage</span>
                      <span className="font-semibold text-foreground">
                        {storageGb ? `${storageGb} GB` : 'Standard'}
                      </span>
                    </div>
                  </div>

                  {/* Included Features */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Included Modules ({plan.includedFeatures?.length || 0}):
                    </span>
                    <ul className="space-y-1.5 text-xs max-h-44 overflow-y-auto custom-scrollbar pr-1">
                      {plan.includedFeatures && plan.includedFeatures.length > 0 ? (
                        plan.includedFeatures.map((f) => (
                          <li key={f} className="flex items-center gap-2 text-foreground/90">
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="capitalize">{f.replace(/_/g, ' ')}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-muted-foreground italic text-xs">No specific modules mapped</li>
                      )}
                    </ul>
                  </div>
                </CardContent>

                <CardFooter className="pt-3 border-t border-border/50 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs hover:border-amber-500/60"
                    onClick={() => handleOpenEdit(plan)}
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                    Edit Plan Limits
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeletingPlan(plan)}
                    title="Delete Plan"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Plan Limits Dialog */}
      <Dialog
        open={isCreateOpen || !!editingPlan}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false);
            setEditingPlan(null);
          }
        }}
      >
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto w-[95vw]">
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? `Edit Plan Limits: ${editingPlan.name}` : 'Create Subscription Plan'}
            </DialogTitle>
            <DialogDescription>
              Configure pricing rates, operational capacity limits, and bundled feature modules.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePlan} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="planName" className="text-xs">Plan Display Name</Label>
                <Input
                  id="planName"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Growth Plan"
                  required
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="planCode" className="text-xs">Plan Code (Unique)</Label>
                <Input
                  id="planCode"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. GROWTH_PRO"
                  disabled={!!editingPlan}
                  required
                  className="h-9 text-xs font-mono uppercase"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="planDesc" className="text-xs">Description</Label>
              <Textarea
                id="planDesc"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Target demographic and value proposition..."
                rows={2}
                className="text-xs resize-none"
              />
            </div>

            {/* Pricing Rates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="monthlyPrice" className="text-xs">Monthly Price (₹)</Label>
                <Input
                  id="monthlyPrice"
                  type="number"
                  min="0"
                  value={formData.priceMonthly}
                  onChange={(e) => setFormData({ ...formData, priceMonthly: Number(e.target.value) })}
                  required
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="yearlyPrice" className="text-xs">Annual Price (₹)</Label>
                <Input
                  id="yearlyPrice"
                  type="number"
                  min="0"
                  value={formData.priceYearly}
                  onChange={(e) => setFormData({ ...formData, priceYearly: Number(e.target.value) })}
                  required
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Capacity Bounds */}
            <div className="space-y-2 pt-2 border-t border-border/50">
              <Label className="text-xs font-bold text-foreground block">
                Operational Capacity Bounds (0 = Unlimited)
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground block">Max Students</span>
                  <Input
                    type="number"
                    min="0"
                    value={formData.maxStudents}
                    onChange={(e) => setFormData({ ...formData, maxStudents: Number(e.target.value) })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground block">Max Rooms</span>
                  <Input
                    type="number"
                    min="0"
                    value={formData.maxRooms}
                    onChange={(e) => setFormData({ ...formData, maxRooms: Number(e.target.value) })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground block">Max Hostels</span>
                  <Input
                    type="number"
                    min="0"
                    value={formData.maxHostels}
                    onChange={(e) => setFormData({ ...formData, maxHostels: Number(e.target.value) })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground block">Storage (GB)</span>
                  <Input
                    type="number"
                    min="0"
                    value={formData.storageGb}
                    onChange={(e) => setFormData({ ...formData, storageGb: Number(e.target.value) })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Included Features Checklist */}
            <div className="space-y-2 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground">
                  Bundled Feature Modules ({formData.includedFeatures.length} selected)
                </Label>
                <div className="flex gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, includedFeatures: availableFeatures.map((f) => f.key) }))}
                    className="text-amber-400 hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-muted-foreground">•</span>
                  <button
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, includedFeatures: [] }))}
                    className="text-muted-foreground hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-2 rounded-xl bg-secondary/20 border border-border/50">
                {availableFeatures.map((feat) => {
                  const checked = formData.includedFeatures.includes(feat.key);
                  return (
                    <label
                      key={feat.key}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                        checked
                          ? 'bg-amber-500/10 border-amber-500/30 text-foreground font-medium'
                          : 'bg-card/50 border-border/40 text-muted-foreground hover:bg-secondary/40'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleFeatureCheck(feat.key)}
                        className="w-3.5 h-3.5 rounded border-border text-amber-500 focus:ring-amber-500"
                      />
                      <span className="truncate">{feat.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Billing Frequencies, Trial Policy & Publishing Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/50">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold block">Allowed Billing Frequencies</Label>
                <div className="flex items-center gap-3 p-2 rounded-lg border border-border/60 bg-secondary/20">
                  {(['MONTHLY', 'YEARLY'] as const).map((cy) => {
                    const checked = formData.allowedBillingCycles.includes(cy);
                    return (
                      <label key={cy} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleCycleCheck(cy)}
                          className="w-3.5 h-3.5 rounded border-border text-amber-500 focus:ring-amber-500"
                        />
                        <span className="font-mono font-medium">{cy}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="planStatus" className="text-xs font-semibold block">Publishing Status</Label>
                <select
                  id="planStatus"
                  value={formData.status}
                  onChange={(e) => {
                    const st = e.target.value as 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
                    setFormData({ ...formData, status: st, isActive: st === 'ACTIVE' });
                  }}
                  className="w-full h-9 px-3 rounded-md bg-background border border-input text-xs text-foreground"
                >
                  <option value="ACTIVE">Published (Active for Onboarding & Billing)</option>
                  <option value="INACTIVE">Unpublished (Inactive / Hidden)</option>
                  <option value="ARCHIVED">Archived (Grandfathered Existing Tenants Only)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-secondary/20 border border-border/50">
              <div className="flex items-center gap-2 sm:col-span-1">
                <input
                  id="trialEligible"
                  type="checkbox"
                  checked={formData.trialEligible}
                  onChange={(e) => setFormData({ ...formData, trialEligible: e.target.checked })}
                  className="w-4 h-4 rounded border-border text-amber-500 focus:ring-amber-500"
                />
                <Label htmlFor="trialEligible" className="text-xs cursor-pointer">
                  Free Trial Eligible
                </Label>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground block">Trial Duration (Days)</span>
                <Input
                  type="number"
                  min="0"
                  disabled={!formData.trialEligible}
                  value={formData.trialEligible ? formData.trialDays : 0}
                  onChange={(e) => setFormData({ ...formData, trialDays: Number(e.target.value) })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground block">Catalog Sort Order</span>
                <Input
                  type="number"
                  min="0"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <input
                  id="isPopular"
                  type="checkbox"
                  checked={formData.isPopular}
                  onChange={(e) => setFormData({ ...formData, isPopular: e.target.checked })}
                  className="w-4 h-4 rounded border-border text-amber-500 focus:ring-amber-500"
                />
                <Label htmlFor="isPopular" className="text-xs cursor-pointer">
                  Highlight as "Most Popular"
                </Label>
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingPlan(null);
                }}
                disabled={isSaving}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving...
                  </>
                ) : editingPlan ? (
                  'Save Plan Changes'
                ) : (
                  'Create Plan'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog
        open={!!deletingPlan}
        onOpenChange={(open) => !open && setDeletingPlan(null)}
      >
        <AlertDialogContent className="max-w-md w-[95vw]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subscription Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold text-foreground">"{deletingPlan?.name}"</span>?
              Existing subscribed organizations will maintain their current billing cycle, but new tenants cannot select this plan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving} className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePlan}
              disabled={isSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-semibold"
            >
              {isSaving ? 'Deleting...' : 'Delete Plan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
