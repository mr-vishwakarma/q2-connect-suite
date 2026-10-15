import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'react-toastify';
import { Settings as SettingsIcon, Save, Clock, IndianRupee } from 'lucide-react';
import { useHostel } from '@/contexts/HostelContext';
import { api } from '@/lib/api';

export default function AdminSettings() {
  const { selectedHostel } = useHostel();
  const [lateFeePerDay, setLateFeePerDay] = useState<number>(20);
  const [gracePeriodDays, setGracePeriodDays] = useState<number>(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/settings/${selectedHostel}`);
      if (res.data?.success) {
        setLateFeePerDay(res.data.data.lateFeePerDay ?? 20);
        setGracePeriodDays(res.data.data.gracePeriodDays ?? 5);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [selectedHostel]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    if (gracePeriodDays < 0 || !Number.isInteger(Number(gracePeriodDays))) {
      toast.error('Grace period must be a non-negative integer');
      return;
    }
    if (lateFeePerDay < 0 || isNaN(Number(lateFeePerDay))) {
      toast.error('Late fee penalty must be a non-negative number');
      return;
    }

    try {
      setSaving(true);
      await api.put(`/settings/${selectedHostel}`, {
        lateFeePerDay: Number(lateFeePerDay),
        gracePeriodDays: Number(gracePeriodDays),
      });
      toast.success('Fee configuration updated successfully');
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading settings...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="flex items-center gap-3">
        <SettingsIcon className="w-8 h-8 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Global Settings</h1>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>Fee Configuration</CardTitle>
          <CardDescription>
            Adjust the policy rules for late fee calculation for {selectedHostel}. Monthly recurring due dates are automatically anchored to each student's joining date.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Grace Period (Days)
            </Label>
            <Input 
              type="number" 
              min="0"
              max="60"
              value={gracePeriodDays}
              onChange={(e) => setGracePeriodDays(Math.max(0, parseInt(e.target.value) || 0))}
            />
            <p className="text-xs text-muted-foreground">
              Number of extra days a student gets to pay their monthly fee after their anchor due date without incurring a late fee penalty.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-primary" />
              Late Fee Penalty Per Day (₹)
            </Label>
            <Input 
              type="number" 
              min="0"
              value={lateFeePerDay}
              onChange={(e) => setLateFeePerDay(Math.max(0, parseFloat(e.target.value) || 0))}
            />
            <p className="text-xs text-muted-foreground">
              Daily penalty amount charged for each calendar day past the grace period.
            </p>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
