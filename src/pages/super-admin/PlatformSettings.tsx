import { useEffect, useState } from 'react';
import {
  Settings,
  Shield,
  Clock,
  HardDrive,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Save,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { superAdminService } from '@/services/api/superAdmin.service';
import { PlatformSettings as PlatformSettingsType } from '@/types';
import { toast } from 'react-toastify';

export default function PlatformSettings() {
  const [settings, setSettings] = useState<PlatformSettingsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'security' | 'trial' | 'maintenance' | 'limits'>('general');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const res = await superAdminService.getPlatformSettings();
      if (res.success && res.data) {
        setSettings(res.data);
      }
    } catch (error) {
      console.error('Failed to load platform settings:', error);
      toast.error('Failed to load platform settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    try {
      setIsSaving(true);
      const res = await superAdminService.updatePlatformSettings(settings);
      if (res.success && res.data) {
        setSettings(res.data);
        toast.success('Platform settings updated successfully!');
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !settings) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="inline-flex items-center gap-2 text-muted-foreground text-sm">
          <RefreshCw className="w-4 h-4 animate-spin text-primary" />
          Loading platform settings...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Platform Control Settings</h1>
          <p className="text-sm text-muted-foreground">Manage global SaaS policies, authentication rules, trial defaults, and limits.</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="bg-primary text-primary-foreground font-semibold">
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Configuration'}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'general'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          General Branding
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'security'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Authentication & Security
        </button>
        <button
          onClick={() => setActiveTab('trial')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'trial'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Trial & Lifecycle
        </button>
        <button
          onClick={() => setActiveTab('maintenance')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'maintenance'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Maintenance Mode
        </button>
        <button
          onClick={() => setActiveTab('limits')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'limits'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Multi-Tenant Limits
        </button>
      </div>

      {/* Settings Form */}
      <form onSubmit={handleSave}>
        {/* General Tab */}
        {activeTab === 'general' && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">General Platform Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-xl">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Platform Name</label>
                <Input
                  value={settings.general.platformName}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      general: { ...settings.general, platformName: e.target.value },
                    })
                  }
                  className="bg-secondary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Global Support Email</label>
                <Input
                  type="email"
                  value={settings.general.supportEmail}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      general: { ...settings.general, supportEmail: e.target.value },
                    })
                  }
                  className="bg-secondary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Global Support Phone</label>
                <Input
                  value={settings.general.supportPhone}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      general: { ...settings.general, supportPhone: e.target.value },
                    })
                  }
                  className="bg-secondary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Default Currency</label>
                  <Input
                    value={settings.general.defaultCurrency}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        general: { ...settings.general, defaultCurrency: e.target.value },
                      })
                    }
                    className="bg-secondary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Default Timezone</label>
                  <Input
                    value={settings.general.defaultTimezone}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        general: { ...settings.general, defaultTimezone: e.target.value },
                      })
                    }
                    className="bg-secondary"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Authentication & Account Lockout Policies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-xl">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Max Failed Login Attempts Before Lockout
                </label>
                <Input
                  type="number"
                  min={3}
                  max={20}
                  value={settings.security.maxLoginAttempts}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      security: { ...settings.security, maxLoginAttempts: Number(e.target.value) },
                    })
                  }
                  className="bg-secondary"
                />
                <p className="text-[11px] text-muted-foreground">Default is 5 attempts to protect against brute-force attacks.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Lockout Duration (Minutes)
                </label>
                <Input
                  type="number"
                  min={5}
                  max={1440}
                  value={settings.security.lockoutDurationMinutes}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      security: { ...settings.security, lockoutDurationMinutes: Number(e.target.value) },
                    })
                  }
                  className="bg-secondary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  JWT Session Lifespan (Hours)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={720}
                  value={settings.security.jwtExpiryHours}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      security: { ...settings.security, jwtExpiryHours: Number(e.target.value) },
                    })
                  }
                  className="bg-secondary"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trial Tab */}
        {activeTab === 'trial' && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Trial & SaaS Lifecycle Rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-xl">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Default Free Trial Days</label>
                <Input
                  type="number"
                  min={7}
                  max={90}
                  value={settings.trial.defaultTrialDays}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      trial: { ...settings.trial, defaultTrialDays: Number(e.target.value) },
                    })
                  }
                  className="bg-secondary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Notify Tenant Days Before Expiration
                </label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={settings.trial.notifyExpiringDaysBefore}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      trial: { ...settings.trial, notifyExpiringDaysBefore: Number(e.target.value) },
                    })
                  }
                  className="bg-secondary"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Maintenance Tab */}
        {activeTab === 'maintenance' && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">System Maintenance Mode</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-xl">
              <div className="flex items-center gap-3 p-3.5 rounded-lg bg-secondary/40 border border-border">
                <input
                  type="checkbox"
                  id="maintenanceToggle"
                  checked={settings.maintenance.isMaintenanceMode}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      maintenance: { ...settings.maintenance, isMaintenanceMode: e.target.checked },
                    })
                  }
                  className="w-4 h-4 rounded text-primary focus:ring-primary"
                />
                <label htmlFor="maintenanceToggle" className="text-sm font-medium text-foreground cursor-pointer">
                  Enable Maintenance Mode (Restricts Tenant Access)
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Public Maintenance Notice Message
                </label>
                <Input
                  value={settings.maintenance.maintenanceMessage}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      maintenance: { ...settings.maintenance, maintenanceMessage: e.target.value },
                    })
                  }
                  className="bg-secondary"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Limits Tab */}
        {activeTab === 'limits' && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Multi-Tenant Platform Safeguards</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-xl">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Max Hostels Per Tenant
                </label>
                <Input
                  type="number"
                  min={1}
                  value={settings.limits.maxHostelsPerTenant}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      limits: { ...settings.limits, maxHostelsPerTenant: Number(e.target.value) },
                    })
                  }
                  className="bg-secondary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Max Students Per Tenant
                </label>
                <Input
                  type="number"
                  min={10}
                  value={settings.limits.maxStudentsPerTenant}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      limits: { ...settings.limits, maxStudentsPerTenant: Number(e.target.value) },
                    })
                  }
                  className="bg-secondary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Max Upload File Size (MB)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={settings.limits.maxFileSizeMb}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      limits: { ...settings.limits, maxFileSizeMb: Number(e.target.value) },
                    })
                  }
                  className="bg-secondary"
                />
              </div>
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  );
}
