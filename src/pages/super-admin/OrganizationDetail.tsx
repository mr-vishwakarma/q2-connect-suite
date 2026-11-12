import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Building2,
  GitFork,
  ToggleLeft,
  CreditCard,
  ArrowLeft,
  Shield,
  CheckCircle,
  Plus,
  FileCheck,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  superAdminService,
  OrganizationDetailResponse,
  OrgFeatureToggleState,
  CreateHostelPayload,
  PopulatedPlanRef,
} from '@/services/api/superAdmin.service';
import { HostelBranch, FeatureDefinition } from '@/types';
import { toast } from 'react-toastify';
import { getErrorMessage } from '@/utils/errorHandling';

export default function OrganizationDetail() {
  const { id } = useParams<{ id: string }>();
  const [org, setOrg] = useState<OrganizationDetailResponse | null>(null);
  const [features, setFeatures] = useState<FeatureDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add branch modal state
  const [isAddBranchOpen, setIsAddBranchOpen] = useState(false);
  const [branchForm, setBranchForm] = useState({
    name: '',
    code: '',
    capacity: 100,
    genderType: 'GIRLS',
    address: '',
  });

  const loadData = useCallback(async (showSpinner = true) => {
    if (!id) return;
    try {
      if (showSpinner) setIsLoading(true);
      const [orgRes, featRes] = await Promise.all([
        superAdminService.getOrganizationById(id),
        superAdminService.getFeatures(),
      ]);

      if (orgRes.success && orgRes.data) {
        setOrg(orgRes.data);
      }
      if (featRes.success && featRes.data) {
        setFeatures(featRes.data);
      }
    } catch (error) {
      console.error('Failed to load organization detail:', error);
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id, loadData]);

  const handleToggleFeature = async (featureKey: string, currentEnabled: boolean) => {
    const newEnabled = !currentEnabled;

    // Instant optimistic update
    setOrg((prev) => {
      if (!prev) return prev;
      const existingFeatures = prev.features || [];
      const idx = existingFeatures.findIndex((f: OrgFeatureToggleState) => f.featureKey === featureKey);
      let updatedFeatures: OrgFeatureToggleState[];
      if (idx >= 0) {
        updatedFeatures = existingFeatures.map((f: OrgFeatureToggleState) =>
          f.featureKey === featureKey ? { ...f, enabled: newEnabled } : f
        );
      } else {
        updatedFeatures = [...existingFeatures, { featureKey, enabled: newEnabled }];
      }
      return { ...prev, features: updatedFeatures };
    });

    try {
      const res = await superAdminService.toggleOrgFeature({
        organizationId: id!,
        featureKey,
        enabled: newEnabled,
      });
      if (res.success) {
        toast.success(`Feature '${featureKey}' ${newEnabled ? 'enabled' : 'disabled'}`);
      } else {
        loadData(false);
      }
    } catch {
      toast.error('Failed to update feature');
      loadData(false);
    }
  };

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: CreateHostelPayload = {
        organizationId: id,
        ...branchForm,
      };
      const res = await superAdminService.createHostel(payload);
      if (res.success) {
        toast.success(`Branch '${branchForm.name}' created!`);
        setIsAddBranchOpen(false);
        setBranchForm({ name: '', code: '', capacity: 100, genderType: 'GIRLS', address: '' });
        loadData();
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to add branch'));
    }
  };

  if (isLoading || !org) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  const enabledFeatureKeys = new Set(
    (org.features || []).filter((f: OrgFeatureToggleState) => f.enabled).map((f: OrgFeatureToggleState) => f.featureKey)
  );

  return (
    <div className="space-y-6">
      {/* Back & Title Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/super-admin/organizations">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{org.name}</h1>
          <p className="text-xs text-muted-foreground font-mono">Tenant ID: {org._id || org.id}</p>
        </div>
      </div>

      {/* Overview Cards & Quotas */}
      {(() => {
        const sub = org.subscription;
        const snap = sub?.pricingSnapshot;
        const planObj: PopulatedPlanRef | null =
          sub?.planId && typeof sub.planId === 'object' ? (sub.planId as PopulatedPlanRef) : null;
        const billingCycle = snap?.billingCycle || sub?.billingCycle || 'MONTHLY';
        const isYearly = String(billingCycle).toUpperCase() === 'YEARLY' || String(billingCycle).toUpperCase() === 'ANNUAL';
        const price =
          snap?.agreedPriceRupees ??
          sub?.agreedPriceRupees ??
          (isYearly ? (planObj?.priceYearly ?? planObj?.price) : (planObj?.priceMonthly ?? planObj?.price));
        const displayPrice =
          price !== undefined && price !== null ? `₹${Number(price).toLocaleString('en-IN')}` : null;
        const maxStudents = snap?.limits?.maxStudents ?? planObj?.limits?.maxStudents;
        const maxHostels = snap?.limits?.maxHostels ?? planObj?.limits?.maxHostels;
        const isUnlimitedStudents = !maxStudents || maxStudents <= 0;
        const isUnlimitedHostels = !maxHostels || maxHostels <= 0;
        const planName = snap?.planName || planObj?.name || null;

        return (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Subscription Plan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <div className="text-xl font-bold text-amber-400">
                  {planName || 'Not Assigned'}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    Billing: {billingCycle}
                  </span>
                  {displayPrice && (
                    <span className="text-xs font-semibold text-emerald-400 font-mono">
                      {displayPrice} / {isYearly ? 'yr' : 'mo'}
                    </span>
                  )}
                </div>
                {sub && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <Badge variant="outline" className="text-[10px]">
                      {sub.status}
                    </Badge>
                    {sub.activationMethod && (
                      <Badge variant="secondary" className="text-[10px]">
                        {String(sub.activationMethod).replace('_', ' ')}
                      </Badge>
                    )}
                    {sub.nearExpiry?.isNearExpiry && (
                      <Badge variant="destructive" className="text-[10px]">
                        Near Expiry ({sub.nearExpiry.daysRemaining}d)
                      </Badge>
                    )}
                  </div>
                )}
                {sub?.scheduledPlanChange?.status === 'SCHEDULED' && (
                  <p className="text-[11px] text-amber-400">
                    Scheduled change to {sub.scheduledPlanChange.targetPlanName}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Registered Students Counter */}
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Active Students</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="flex justify-between items-baseline">
                  <span className="text-xl font-bold text-foreground">{org.studentCount || 0}</span>
                  <span className="text-xs text-emerald-400 font-mono">
                    {isUnlimitedStudents ? 'Unlimited Capacity' : `Limit: ${maxStudents}`}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isUnlimitedStudents
                    ? 'Unlimited resident capacity under current plan'
                    : `${Math.max(0, Number(maxStudents) - Number(org.studentCount || 0))} beds remaining`}
                </p>
              </CardContent>
            </Card>

            {/* Hostel Branches Counter */}
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Hostel Branches</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="flex justify-between items-baseline">
                  <span className="text-xl font-bold text-foreground">{org.hostels?.length || 0}</span>
                  <span className="text-xs text-blue-400 font-mono">
                    {isUnlimitedHostels ? 'Unlimited Branches' : `Limit: ${maxHostels}`}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isUnlimitedHostels ? 'Multi-branch management enabled' : `Up to ${maxHostels} branches in plan`}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Tenant Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <Badge
                  className={
                    org.status === 'ACTIVE'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-sm'
                      : org.status === 'SUSPENDED' || org.status === 'PAYMENT_FAILED' || org.status === 'EXPIRED'
                      ? 'bg-destructive/20 text-destructive border-destructive/30 text-sm'
                      : 'bg-amber-500/20 text-amber-400 border-amber-500/30 text-sm'
                  }
                >
                  {org.status}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1 truncate">{org.contactEmail}</p>
                {sub?.status === 'TRIAL' && sub?.trialEndsAt && (
                  <p className="text-[11px] text-amber-400 font-mono">
                    Trial ends {new Date(sub.trialEndsAt).toLocaleDateString('en-IN')}
                  </p>
                )}
                {sub?.status === 'ACTIVE' && sub?.currentPeriodEnd && (
                  <p className="text-[11px] text-muted-foreground font-mono">
                    Renews {new Date(sub.currentPeriodEnd).toLocaleDateString('en-IN')}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* Statutory KYC & Aadhaar Verification Card */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-amber-400" />
              Statutory KYC & Aadhaar Compliance
            </CardTitle>
            <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400">
              {org.orgType || 'Multi-Branch Chain'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
              <span className="text-muted-foreground block mb-1">Aadhaar Card UID</span>
              <span className="font-mono font-semibold text-foreground text-sm">
                {org.aadhaarNumber || 'Not provided'}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
              <span className="text-muted-foreground block mb-1">Aadhaar Document / Photo</span>
              {org.aadhaarDocument ? (
                <a
                  href={org.aadhaarDocument}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-semibold mt-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> View Photo Document
                </a>
              ) : (
                <span className="text-muted-foreground italic mt-1 block">No photo document uploaded</span>
              )}
            </div>
            <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
              <span className="text-muted-foreground block mb-1">GSTIN Number</span>
              <span className="font-mono font-semibold text-foreground text-sm">
                {org.gstin || 'Not provided'}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
              <span className="text-muted-foreground block mb-1">Business PAN / TAN</span>
              <span className="font-mono font-semibold text-foreground text-sm">
                {org.pan || 'Not provided'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Branches & Feature Gating Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Branches */}
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <GitFork className="w-4 h-4 text-blue-400" />
              Hostel Branches ({org.hostels?.length || 0})
            </CardTitle>
            <Button size="sm" onClick={() => setIsAddBranchOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Branch
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {org.hostels && org.hostels.length > 0 ? (
                org.hostels.map((h: HostelBranch) => (
                  <div key={h._id || h.id} className="p-3 rounded-xl bg-secondary/30 border border-border/50 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-foreground text-sm block">{h.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">Code: {h.code} • Capacity: {h.capacity || 100}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">{h.genderType}</Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-muted-foreground">No branches found</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Feature Flags Gating */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ToggleLeft className="w-4 h-4 text-amber-400" />
              Feature Flags & Module Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar pr-1">
              {features.map((feat) => {
                const isEnabled = enabledFeatureKeys.has(feat.key);
                return (
                  <div key={feat.key} className="p-3 rounded-xl bg-secondary/30 border border-border/50 flex items-center justify-between">
                    <div className="pr-4">
                      <span className="font-semibold text-foreground text-sm block">{feat.name}</span>
                      <span className="text-xs text-muted-foreground">{feat.description}</span>
                    </div>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={() => handleToggleFeature(feat.key, isEnabled)}
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Branch Modal */}
      <Dialog open={isAddBranchOpen} onOpenChange={setIsAddBranchOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Hostel Branch</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddBranch} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Branch Name *</Label>
              <Input
                required
                placeholder="e.g. Q2 Girls Hostel - Madhapur"
                value={branchForm.name}
                onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Branch Code *</Label>
                <Input
                  required
                  placeholder="e.g. MADHAPUR"
                  value={branchForm.code}
                  onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Capacity (Beds)</Label>
                <Input
                  type="number"
                  value={branchForm.capacity}
                  onChange={(e) => setBranchForm({ ...branchForm, capacity: Number(e.target.value) })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddBranchOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-black font-semibold">
                Create Branch
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
