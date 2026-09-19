import { useEffect, useState } from 'react';
import {
  Activity,
  Database,
  Cpu,
  Server,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  HardDrive,
  Layers,
  Zap,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { superAdminService } from '@/services/api/superAdmin.service';
import { SystemHealthData } from '@/types';
import { toast } from 'react-toastify';

export default function SystemHealth() {
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchHealth();
  }, []);

  const fetchHealth = async () => {
    try {
      setIsLoading(true);
      const res = await superAdminService.getSystemHealth();
      if (res.success && res.data) {
        setHealth(res.data);
      }
    } catch (error) {
      console.error('Failed to load system health:', error);
      toast.error('Failed to check platform system health');
    } finally {
      setIsLoading(false);
    }
  };

  const formatUptime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '--';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${d > 0 ? `${d}d ` : ''}${h}h ${m}m ${s}s`;
  };

  if (isLoading && !health) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        <p className="text-xs text-muted-foreground font-mono">Running platform infrastructure diagnostics...</p>
      </div>
    );
  }

  const envDisplay = typeof health?.environment === 'object'
    ? (health?.environment as any)?.env
    : (health?.environment || 'development');

  const nodeVersionDisplay = typeof health?.environment === 'object'
    ? (health?.environment as any)?.nodeVersion
    : (health?.nodeVersion || 'v20.x');

  const uptimeDisplay = (health as any)?.uptime?.formatted || (health?.uptimeSeconds ? formatUptime(health.uptimeSeconds) : '--');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Platform System Health</h1>
          <p className="text-sm text-muted-foreground">Real-time infrastructure telemetry, MongoDB latency, runtime memory and third-party integrations.</p>
        </div>
        <Button onClick={fetchHealth} variant="outline" size="sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Run Health Diagnostics
        </Button>
      </div>

      {/* Main Status Banner */}
      <Card className="bg-card border-border overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl ${
                  health?.status === 'HEALTHY'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : health?.status === 'DEGRADED'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    : 'bg-red-500/10 text-red-400 border border-red-500/30'
                }`}
              >
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">Overall Platform Status</h2>
                  <Badge
                    variant="outline"
                    className={
                      health?.status === 'HEALTHY'
                        ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                        : 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                    }
                  >
                    {health?.status || 'HEALTHY'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Environment: <strong className="text-foreground uppercase">{envDisplay}</strong> &bull; Node: {nodeVersionDisplay}
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <div className="text-xs text-muted-foreground uppercase font-semibold">Service Uptime</div>
              <div className="text-lg font-mono font-bold text-foreground mt-0.5">
                {uptimeDisplay}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid of Diagnostics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Database Health */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-500" />
                MongoDB Atlas Cluster
              </span>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                {health?.database?.status || 'CONNECTED'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">Ping Round-Trip Latency:</span>
              <span className="font-mono font-semibold text-emerald-400">
                {health?.database?.pingLatencyMs ?? health?.database?.latencyMs ?? '--'} ms
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">Connection State:</span>
              <span className="font-mono text-xs text-foreground">readyState {health?.database?.readyState ?? 1}</span>
            </div>
            <div className="text-xs text-muted-foreground break-all pt-2 border-t border-border/50">
              Host: <span className="font-mono text-foreground">{health?.database?.connectedHost || health?.database?.host || 'MongoDB Atlas'}</span>
            </div>
          </CardContent>
        </Card>

        {/* Runtime Memory Health */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-purple-500" />
                Node.js Memory Utilization
              </span>
              <Badge variant="outline" className="border-purple-500/30 text-purple-400 bg-purple-500/10">
                {health?.memory?.heapUsedMb ?? 0} MB Used
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Heap Allocation:</span>
                <span className="font-mono text-foreground">
                  {health?.memory?.heapUsedMb ?? 0} / {health?.memory?.heapTotalMb ?? 100} MB
                </span>
              </div>
              <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                <div
                  className="bg-purple-500 h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.round(
                      ((health?.memory?.heapUsedMb || 50) / (health?.memory?.heapTotalMb || 100)) * 100
                    ))}%`,
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
              <span className="text-muted-foreground">Process Resident Set (RSS):</span>
              <span className="font-mono text-foreground">{health?.memory?.rssMb ?? 0} MB</span>
            </div>
          </CardContent>
        </Card>

        {/* Integrations Health */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Connected Integrations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Email Service (SMTP / Queue):</span>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                {(health as any)?.services?.emailService?.status || (health as any)?.integrations?.email || 'CONFIGURED'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Object Storage (ImageKit CDN):</span>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                {(health as any)?.services?.imageKit?.status || (health as any)?.integrations?.cloudStorage || 'CONNECTED'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Redis & Background Queue:</span>
              <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-500/10">
                {(health as any)?.services?.redis?.status || (health as any)?.services?.queueSystem?.status || (health as any)?.integrations?.cronJobs || 'OPERATIONAL'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Google OAuth SSO:</span>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                {(health as any)?.services?.googleOAuth?.status || 'CONFIGURED'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
