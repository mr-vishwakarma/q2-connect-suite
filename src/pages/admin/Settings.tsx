import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-toastify';
import {
  Settings as SettingsIcon,
  Save,
  Clock,
  IndianRupee,
  ShieldCheck,
  Moon,
  Shirt,
  Building2,
  AlertCircle,
} from 'lucide-react';
import { useHostel } from '@/contexts/HostelContext';
import { api } from '@/lib/api';

export default function AdminSettings() {
  const { selectedHostel, currentBranch } = useHostel();
  const [lateFeePerDay, setLateFeePerDay] = useState<number>(20);
  const [gracePeriodDays, setGracePeriodDays] = useState<number>(5);
  const [securityDeposit, setSecurityDeposit] = useState<number>(5000);
  const [curfewTime, setCurfewTime] = useState<string>('21:30');
  const [weeklyLaundrySlots, setWeeklyLaundrySlots] = useState<number>(2);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!selectedHostel) return;
    try {
      setLoading(true);
      const res = await api.get(`/settings/${selectedHostel}`);
      if (res.data?.success && res.data.data) {
        const d = res.data.data;
        setLateFeePerDay(d.lateFeePerDay ?? 20);
        setGracePeriodDays(d.gracePeriodDays ?? 5);
        setSecurityDeposit(d.securityDeposit ?? 5000);
        setCurfewTime(d.curfewTime || '21:30');
        setWeeklyLaundrySlots(d.weeklyLaundrySlots ?? d.laundrySlotsPerWeek ?? 2);
      }
    } catch (error) {
      console.error('Failed to load hostel settings:', error);
      toast.error('Failed to load operational settings for this hostel branch');
    } finally {
      setLoading(false);
    }
  }, [selectedHostel]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    if (gracePeriodDays < 0 || !Number.isInteger(Number(gracePeriodDays)) || Number(gracePeriodDays) > 60) {
      toast.error('Grace period must be an integer between 0 and 60 days');
      return;
    }
    if (lateFeePerDay < 0 || isNaN(Number(lateFeePerDay)) || Number(lateFeePerDay) > 10000) {
      toast.error('Late fee penalty must be a valid amount between ₹0 and ₹10,000');
      return;
    }
    if (securityDeposit < 0 || isNaN(Number(securityDeposit)) || Number(securityDeposit) > 500000) {
      toast.error('Security deposit must be a valid amount between ₹0 and ₹5,00,000');
      return;
    }
    if (!curfewTime || !curfewTime.trim()) {
      toast.error('Please specify a valid night curfew timing (e.g. 21:30)');
      return;
    }
    if (weeklyLaundrySlots < 0 || !Number.isInteger(Number(weeklyLaundrySlots)) || Number(weeklyLaundrySlots) > 50) {
      toast.error('Weekly laundry slots must be an integer between 0 and 50');
      return;
    }

    try {
      setSaving(true);
      await api.put(`/settings/${selectedHostel}`, {
        lateFeePerDay: Number(lateFeePerDay),
        gracePeriodDays: Number(gracePeriodDays),
        securityDeposit: Number(securityDeposit),
        curfewTime: curfewTime.trim(),
        weeklyLaundrySlots: Number(weeklyLaundrySlots),
        laundrySlotsPerWeek: Number(weeklyLaundrySlots),
      });
      toast.success(`Operational policies for branch '${selectedHostel}' saved successfully!`);
    } catch (error: any) {
      console.error('Failed to save settings:', error);
      toast.error(error.response?.data?.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-muted-foreground animate-pulse space-y-3">
        <SettingsIcon className="w-8 h-8 animate-spin mx-auto text-amber-500 opacity-60" />
        <p className="text-sm">Loading hostel operational policies...</p>
      </div>
    );
  }

  const branchDisplay = currentBranch?.name || selectedHostel || 'Current Hostel';

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Hostel Settings &amp; Policies</h1>
            <p className="text-xs text-muted-foreground">
              Configure hostel rules, payment policies, security deposits, and curfew timings.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="border-amber-500/40 text-amber-300 bg-amber-500/10 px-3 py-1 text-xs w-fit flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5" />
          Branch: {selectedHostel}
        </Badge>
      </div>

      {/* Main Living Operations & Rules Card */}
      <Card className="border-border shadow-sm">
        <CardHeader className="border-b border-border/60 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Living Operations &amp; Rules
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Policy settings for <strong>{branchDisplay}</strong> ({selectedHostel}). Changes made here are strictly isolated to this hostel property and do not affect other branches or Hosteliq SaaS subscription billing.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Section 1: Financial & Fee Policies */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 border-b border-border/40 pb-2">
              <IndianRupee className="w-4 h-4 text-amber-400" />
              Fee, Late Penalty &amp; Deposit Policies
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Grace Period */}
              <div className="space-y-1.5">
                <Label htmlFor="graceDays" className="flex items-center gap-1.5 text-xs font-semibold">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  Grace Period (Days)
                </Label>
                <Input
                  id="graceDays"
                  type="number"
                  min="0"
                  max="60"
                  value={gracePeriodDays}
                  onChange={(e) => setGracePeriodDays(Math.max(0, parseInt(e.target.value) || 0))}
                  className="h-9 text-xs"
                />
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Days granted after a student&apos;s anchor due date before daily late fees accumulate.
                </p>
              </div>

              {/* Late Fee Penalty Per Day */}
              <div className="space-y-1.5">
                <Label htmlFor="lateFee" className="flex items-center gap-1.5 text-xs font-semibold">
                  <IndianRupee className="w-3.5 h-3.5 text-primary" />
                  Late Fee / Day (₹)
                </Label>
                <Input
                  id="lateFee"
                  type="number"
                  min="0"
                  max="10000"
                  value={lateFeePerDay}
                  onChange={(e) => setLateFeePerDay(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="h-9 text-xs"
                />
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Daily overdue surcharge charged for each day past the grace period.
                </p>
              </div>

              {/* Security Deposit */}
              <div className="space-y-1.5">
                <Label htmlFor="securityDeposit" className="flex items-center gap-1.5 text-xs font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Security Deposit (₹)
                </Label>
                <Input
                  id="securityDeposit"
                  type="number"
                  min="0"
                  max="500000"
                  value={securityDeposit}
                  onChange={(e) => setSecurityDeposit(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="h-9 text-xs"
                />
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Default refundable deposit automatically prefilled during new student admission.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Living Operations & Facility Rules */}
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 border-b border-border/40 pb-2">
              <Moon className="w-4 h-4 text-purple-400" />
              Living Operations &amp; Resident Rules
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Night Curfew */}
              <div className="space-y-1.5">
                <Label htmlFor="curfewTime" className="flex items-center gap-1.5 text-xs font-semibold">
                  <Moon className="w-3.5 h-3.5 text-purple-400" />
                  Night Curfew Timing
                </Label>
                <Input
                  id="curfewTime"
                  type="time"
                  value={curfewTime}
                  onChange={(e) => setCurfewTime(e.target.value)}
                  className="h-9 text-xs"
                />
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Designated main gate night lock curfew for resident check-in audits.
                </p>
              </div>

              {/* Weekly Laundry Slots */}
              <div className="space-y-1.5">
                <Label htmlFor="weeklyLaundry" className="flex items-center gap-1.5 text-xs font-semibold">
                  <Shirt className="w-3.5 h-3.5 text-blue-400" />
                  Weekly Laundry Slots
                </Label>
                <Input
                  id="weeklyLaundry"
                  type="number"
                  min="0"
                  max="50"
                  value={weeklyLaundrySlots}
                  onChange={(e) => setWeeklyLaundrySlots(Math.max(0, parseInt(e.target.value) || 0))}
                  className="h-9 text-xs"
                />
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Maximum permitted washing machine reservations per resident per week.
                </p>
              </div>
            </div>
          </div>

          {/* Isolation Guarantee Banner */}
          <div className="p-3.5 rounded-lg bg-secondary/30 border border-border/60 flex items-start gap-2.5 text-xs text-muted-foreground">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Data Isolation Guarantee:</strong> Operational policy updates are scoped exclusively to branch <strong>{selectedHostel}</strong>. Modifying these rules will not alter other properties in your chain or your Hosteliq SaaS subscription plan.
            </div>
          </div>

          {/* Save Action */}
          <div className="pt-2 flex items-center justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs gap-2 px-6 h-9 shadow"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving Changes...' : 'Save Policy Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

