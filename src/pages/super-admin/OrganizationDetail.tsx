import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { superAdminService } from '@/services/api/superAdmin.service';
import { Organization, HostelBranch, FeatureDefinition } from '@/types';
import { toast } from 'react-toastify';

export default function OrganizationDetail() {
  const { id } = useParams<{ id: string }>();
  const [org, setOrg] = useState<any>(null);
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

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async (showSpinner = true) => {
    try {
      if (showSpinner) setIsLoading(true);
      const [orgRes, featRes] = await Promise.all([
        superAdminService.getOrganizationById(id!),
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
  };

  const handleToggleFeature = async (featureKey: string, currentEnabled: boolean) => {
    const newEnabled = !currentEnabled;

    // Instant optimistic update
    setOrg((prev: any) => {
      if (!prev) return prev;
      const existingFeatures = prev.features || [];
      const idx = existingFeatures.findIndex((f: any) => f.featureKey === featureKey);
      let updatedFeatures;
      if (idx >= 0) {
        updatedFeatures = existingFeatures.map((f: any) =>
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
    } catch (error) {
      toast.error('Failed to update feature');
      loadData(false);
    }
  };

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await superAdminService.createHostel({
        organizationId: id,
        ...branchForm,
      } as any);
      if (res.success) {
        toast.success(`Branch '${branchForm.name}' created!`);
        setIsAddBranchOpen(false);
        setBranchForm({ name: '', code: '', capacity: 100, genderType: 'GIRLS', address: '' });
        loadData();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add branch');
    }
  };

  if (isLoading || !org) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  const enabledFeatureKeys = new Set((org.features || []).filter((f: any) => f.enabled).map((f: any) => f.featureKey));

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Subscription Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-amber-400">{org.subscription?.planId?.name || 'Starter Plan'}</div>
            <p className="text-xs text-muted-foreground mt-1">Billing: {org.subscription?.billingCycle || 'Monthly'}</p>
          </CardContent>
        </Card>

        {/* Student Quota Meter */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Student Quota</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="flex justify-between items-baseline">
              <span className="text-xl font-bold text-foreground">{org.studentCount || 0}</span>
              <span className="text-xs text-muted-foreground font-mono">Max {org.subscription?.planId?.limits?.maxStudents || 100}</span>
            </div>
            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  ((org.studentCount || 0) / (org.subscription?.planId?.limits?.maxStudents || 100)) > 0.85
                    ? 'bg-rose-500'
                    : 'bg-emerald-500'
                }`}
                style={{
                  width: `${Math.min(100, ((org.studentCount || 0) / (org.subscription?.planId?.limits?.maxStudents || 100)) * 100)}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Branch Quota Meter */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Hostel Branches</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="flex justify-between items-baseline">
              <span className="text-xl font-bold text-foreground">{org.hostels?.length || 0}</span>
              <span className="text-xs text-muted-foreground font-mono">Max {org.subscription?.planId?.limits?.maxHostels || 5}</span>
            </div>
            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-500 h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, ((org.hostels?.length || 0) / (org.subscription?.planId?.limits?.maxHostels || 5)) * 100)}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Tenant Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-sm">
              {org.status}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1 truncate">{org.contactEmail}</p>
          </CardContent>
        </Card>
      </div>

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
