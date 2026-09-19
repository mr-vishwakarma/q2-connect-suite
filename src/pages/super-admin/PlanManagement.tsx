import { useEffect, useState } from 'react';
import { CreditCard, Check, Plus, Edit, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { superAdminService } from '@/services/api/superAdmin.service';
import { SubscriptionPlan } from '@/types';
import { toast } from 'react-toastify';

export default function PlanManagement() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form edit state
  const [formData, setFormData] = useState({
    name: '',
    priceMonthly: 0,
    priceYearly: 0,
    description: '',
    maxStudents: 0,
    maxRooms: 50,
    maxHostels: 1,
    isPopular: false,
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setIsLoading(true);
      const res = await superAdminService.getPlans();
      if (res.success && res.data) {
        setPlans(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch plans:', error);
      toast.error('Failed to load subscription plans');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenEdit = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name || '',
      priceMonthly: plan.priceMonthly || 0,
      priceYearly: plan.priceYearly || 0,
      description: plan.description || '',
      maxStudents: plan.limits?.maxStudents ?? 0,
      maxRooms: plan.limits?.maxRooms ?? 50,
      maxHostels: plan.limits?.maxHostels ?? 1,
      isPopular: plan.isPopular || false,
    });
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;

    try {
      setIsSaving(true);
      const planId = (editingPlan as any)._id || editingPlan.id;
      const payload: any = {
        name: formData.name,
        priceMonthly: Number(formData.priceMonthly),
        priceYearly: Number(formData.priceYearly),
        description: formData.description,
        limits: {
          ...editingPlan.limits,
          maxStudents: Number(formData.maxStudents),
          maxRooms: Number(formData.maxRooms),
          maxHostels: Number(formData.maxHostels),
        },
        isPopular: formData.isPopular,
      };

      const res = await superAdminService.updatePlan(planId, payload);
      if (res.success) {
        toast.success(`Plan '${formData.name}' updated successfully`);
        setEditingPlan(null);
        fetchPlans();
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update plan limits');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Subscription Plans & Limits</h1>
          <p className="text-sm text-muted-foreground">Manage SaaS pricing tiers, student capacity limits, and feature packages.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const maxStudents = plan.limits?.maxStudents;
          const isUnlimited = !maxStudents || maxStudents <= 0;

          return (
            <Card
              key={plan._id || plan.id}
              className={`border flex flex-col justify-between ${
                plan.isPopular
                  ? 'border-amber-500/60 shadow-lg shadow-amber-500/5 bg-gradient-to-b from-card to-amber-500/5'
                  : 'border-border/60'
              }`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold">{plan.name}</CardTitle>
                  {plan.isPopular && <Badge className="bg-amber-500 text-black font-bold text-[10px]">MOST POPULAR</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
                <div className="pt-4 flex items-baseline justify-between">
                  <div>
                    <span className="text-3xl font-black text-foreground">₹{plan.priceMonthly?.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground"> / month</span>
                  </div>
                  {plan.priceYearly ? (
                    <span className="text-xs text-emerald-400 font-mono">
                      ₹{plan.priceYearly?.toLocaleString()} / yr
                    </span>
                  ) : null}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="p-3 rounded-lg bg-secondary/40 border border-border/50 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Student Quota:</span>
                    <span className="font-bold text-foreground font-mono">
                      {isUnlimited ? 'Unlimited' : maxStudents}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Rooms:</span>
                    <span className="font-bold text-foreground font-mono">{plan.limits?.maxRooms || 50}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Hostels:</span>
                    <span className="font-bold text-foreground font-mono">{plan.limits?.maxHostels || 1}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Included Modules:</span>
                  <ul className="space-y-1 text-xs">
                    {plan.includedFeatures?.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-foreground">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{f.replace(/_/g, ' ')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>

              <CardFooter className="pt-4 border-t border-border/50">
                <Button
                  variant="outline"
                  className="w-full text-xs hover:border-amber-500/60"
                  onClick={() => handleOpenEdit(plan)}
                >
                  <Edit className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                  Edit Plan Limits
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Edit Plan Limits Dialog */}
      <Dialog open={!!editingPlan} onOpenChange={(open) => !open && setEditingPlan(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Plan Limits: {editingPlan?.name}</DialogTitle>
            <DialogDescription>
              Adjust pricing rates and operational bounds. Changes apply to newly onboarded tenants and active renewals.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePlan} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="planName" className="text-xs">Plan Display Name</Label>
              <Input
                id="planName"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="h-9 text-xs"
              />
            </div>

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

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="maxStudents" className="text-xs">
                  Max Students <span className="text-[10px] text-muted-foreground block">(0 = Unlimited)</span>
                </Label>
                <Input
                  id="maxStudents"
                  type="number"
                  min="0"
                  value={formData.maxStudents}
                  onChange={(e) => setFormData({ ...formData, maxStudents: Number(e.target.value) })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="maxRooms" className="text-xs">
                  Max Rooms <span className="text-[10px] text-muted-foreground block">(Per Branch)</span>
                </Label>
                <Input
                  id="maxRooms"
                  type="number"
                  min="1"
                  value={formData.maxRooms}
                  onChange={(e) => setFormData({ ...formData, maxRooms: Number(e.target.value) })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="maxHostels" className="text-xs">
                  Hostel Branches <span className="text-[10px] text-muted-foreground block">(Total Allowed)</span>
                </Label>
                <Input
                  id="maxHostels"
                  type="number"
                  min="1"
                  value={formData.maxHostels}
                  onChange={(e) => setFormData({ ...formData, maxHostels: Number(e.target.value) })}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                id="isPopular"
                type="checkbox"
                checked={formData.isPopular}
                onChange={(e) => setFormData({ ...formData, isPopular: e.target.checked })}
                className="w-4 h-4 rounded border-border text-amber-500 focus:ring-amber-500"
              />
              <Label htmlFor="isPopular" className="text-xs cursor-pointer">
                Highlight as "Most Popular" plan on public pricing pages
              </Label>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setEditingPlan(null)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold">
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                  </>
                ) : (
                  'Save Plan Changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
