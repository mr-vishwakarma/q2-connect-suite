import { useEffect, useState } from 'react';
import {
  ShieldAlert,
  Lock,
  Unlock,
  AlertTriangle,
  ShieldCheck,
  Users,
  RefreshCw,
  Clock,
  Globe,
  Key,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { superAdminService } from '@/services/api/superAdmin.service';
import { SecurityOverview } from '@/types';
import { toast } from 'react-toastify';

export default function SecurityCenter() {
  const [data, setData] = useState<SecurityOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSecurityOverview();
  }, []);

  const fetchSecurityOverview = async () => {
    try {
      setIsLoading(true);
      const res = await superAdminService.getSecurityOverview();
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (error) {
      console.error('Failed to load security overview:', error);
      toast.error('Failed to load security data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlockUser = async (userId: string, userName: string) => {
    try {
      const res = await superAdminService.unlockSecurityUser(userId);
      if (res.success) {
        toast.success(`Account unlocked for "${userName}"`);
        fetchSecurityOverview();
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to unlock user');
    }
  };

  const metrics = data?.metrics;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Security Command Center</h1>
          <p className="text-sm text-muted-foreground">Monitor platform security anomalies, brute-force lockouts, and administrative audit trails.</p>
        </div>
        <Button onClick={fetchSecurityOverview} variant="outline" size="sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Scan & Refresh
        </Button>
      </div>

      {/* Security KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border/60">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Locked Accounts</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {metrics?.lockedAccountsCount ?? 0}
              </h3>
              <p className="text-xs text-amber-500 font-medium mt-1">Brute-force protection</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Lock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/60">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">High Risk Users</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {metrics?.highRiskUsersCount ?? 0}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Multiple failed attempts</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/60">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Super Admin Users</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {metrics?.activeSuperAdminsCount ?? 0}
              </h3>
              <p className="text-xs text-emerald-500 font-medium mt-1">Authoritative Root</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
              <Key className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/60">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recent Privileged Actions</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {metrics?.recentCriticalEventsCount ?? 0}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Last 24 hours</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Currently Locked Accounts */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-500" />
              Locked User Accounts (Action Required)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.lockedUsers?.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-60" />
                No accounts currently locked. Platform authentication is running cleanly.
              </div>
            ) : (
              <div className="space-y-3">
                {data?.lockedUsers?.map((u) => (
                  <div
                    key={u._id}
                    className="p-3.5 rounded-lg bg-secondary/30 border border-border flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-foreground text-sm">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                      <div className="text-xs text-amber-400 mt-1">
                        Locked until: {new Date(u.lockUntil).toLocaleTimeString()} ({u.failedLoginAttempts} failed attempts)
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                      onClick={() => handleUnlockUser(u._id, u.name)}
                    >
                      <Unlock className="w-3.5 h-3.5 mr-1" />
                      Unlock
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Critical Security Events */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-primary" />
              Recent Privileged & Security Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.securityEvents?.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No recent security incidents logged.
              </div>
            ) : (
              <div className="space-y-3">
                {data?.securityEvents?.map((ev) => (
                  <div
                    key={ev._id}
                    className="p-3 rounded-lg bg-secondary/20 border border-border/50 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">
                        {ev.description || ev.action?.replace(/_/g, ' ')}
                      </span>
                      <span className="text-muted-foreground font-mono">
                        {new Date(ev.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span>Actor: {ev.actorName || 'System / Admin'} {ev.actorRole ? `(${ev.actorRole})` : ''}</span>
                      <span>&bull;</span>
                      <span>Target: {ev.entityType}</span>
                      {ev.result && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 h-4 ${
                            ev.result === 'SUCCESS'
                              ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                              : 'text-rose-400 border-rose-500/30 bg-rose-500/10'
                          }`}
                        >
                          {ev.result}
                        </Badge>
                      )}
                    </div>
                    {ev.ipAddress && (
                      <div className="text-muted-foreground font-mono text-[11px] flex items-center gap-1">
                        <Globe className="w-3 h-3 text-muted-foreground" />
                        IP: {ev.ipAddress}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
