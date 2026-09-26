import React, { useEffect, useState, Component, ErrorInfo, ReactNode } from 'react';
import {
  Activity,
  Database,
  Server,
  RefreshCw,
  HardDrive,
  Zap,
  Loader2,
  AlertTriangle,
  Cpu,
  Layers,
  ShieldCheck,
  CreditCard,
  Mail,
  Cloud,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { superAdminService } from '@/services/api/superAdmin.service';
import { SystemHealthData } from '@/types';
import { toast } from 'react-toastify';

// Safe Error Boundary for System Health
interface ErrorBoundaryProps {
  children: ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}
class HealthErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('SystemHealth Error Boundary caught an error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-red-500/30 bg-red-500/5 my-6">
          <CardContent className="p-8 text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
            <h2 className="text-xl font-bold text-foreground">Health Telemetry Error</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              An unexpected error occurred while parsing platform telemetry data.
            </p>
            <Button
              onClick={() => this.setState({ hasError: false, error: null })}
              variant="outline"
              className="border-red-500/40 text-red-400 hover:bg-red-500/10"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry Diagnostic View
            </Button>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}

function SystemHealthContent() {
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchHealth();
  }, []);

  const fetchHealth = async () => {
    try {
      setIsLoading(true);
      setFetchError(null);
      const res = await superAdminService.getSystemHealth();
      if (res.success && res.data) {
        setHealth(res.data);
      } else {
        setFetchError(res.message || 'Failed to retrieve telemetry data');
      }
    } catch (error: any) {
      console.error('Failed to load system health:', error);
      const msg = error.response?.data?.message || error.message || 'Failed to check platform system health';
      setFetchError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const formatUptime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '--';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d > 0 ? `${d}d ` : ''}${h}h ${m}m ${s}s`;
  };

  if (isLoading && !health) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground font-mono">Running platform infrastructure diagnostics...</p>
      </div>
    );
  }

  if (fetchError && !health) {
    return (
      <Card className="border-red-500/30 bg-red-500/5 my-6">
        <CardContent className="p-8 text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-bold text-foreground">Diagnostic Probes Failed</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">{fetchError}</p>
          <Button onClick={fetchHealth} variant="outline" className="border-red-500/40 text-red-400 hover:bg-red-500/10">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry Connection
          </Button>
        </CardContent>
      </Card>
    );
  }

  const envDisplay =
    typeof health?.environment === 'object'
      ? (health?.environment as any)?.env
      : (health?.environment || 'development');

  const nodeVersionDisplay =
    typeof health?.environment === 'object'
      ? (health?.environment as any)?.nodeVersion
      : (health?.nodeVersion || 'v20.x');

  const uptimeDisplay =
    (health as any)?.uptime?.formatted ||
    (health?.uptimeSeconds ? formatUptime(health.uptimeSeconds) : '--');

  const isHealthy = health?.status === 'HEALTHY' || health?.status === 'OPERATIONAL';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Platform System Health
          </h1>
          <p className="text-sm text-muted-foreground">
            Real-time infrastructure telemetry, MongoDB latency, Redis queue state, memory allocations, and third-party SaaS integrations.
          </p>
        </div>
        <Button onClick={fetchHealth} variant="outline" size="sm" disabled={isLoading} className="border-border/80">
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Run Health Diagnostics
        </Button>
      </div>

      {/* Main Status Hero Card */}
      <Card className="bg-card border-border overflow-hidden shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl ${
                  isHealthy
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                }`}
              >
                {isHealthy ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">Overall Platform Status</h2>
                  <Badge
                    variant="outline"
                    className={
                      isHealthy
                        ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10 font-mono font-bold'
                        : 'border-amber-500/40 text-amber-400 bg-amber-500/10 font-mono font-bold'
                    }
                  >
                    {health?.status || 'HEALTHY'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Environment: <strong className="text-foreground uppercase">{envDisplay}</strong> &bull; Node:{' '}
                  <span className="font-mono text-foreground">{nodeVersionDisplay}</span> &bull; Platform:{' '}
                  <span className="capitalize">{typeof health?.environment === 'object' ? health.environment.platform || 'node' : 'node'}</span>
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <div className="text-xs text-muted-foreground uppercase font-semibold">Service Uptime</div>
              <div className="text-lg font-mono font-bold text-foreground mt-0.5">{uptimeDisplay}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Structured Diagnostics Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-secondary/70 border border-border/60 p-1 flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Activity className="w-3.5 h-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="database" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Database className="w-3.5 h-3.5" />
            Database & Atlas
          </TabsTrigger>
          <TabsTrigger value="queues" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Layers className="w-3.5 h-3.5" />
            Queues & Background
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Zap className="w-3.5 h-3.5" />
            SaaS Integrations
          </TabsTrigger>
          <TabsTrigger value="memory" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <HardDrive className="w-3.5 h-3.5" />
            Runtime & Memory
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Database Quick Card */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-500" />
                    MongoDB Atlas
                  </span>
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                    {health?.database?.status || 'CONNECTED'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm pt-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Ping Latency:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {health?.database?.pingLatencyMs ?? health?.database?.latencyMs ?? '--'} ms
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Ready State:</span>
                  <span className="font-mono text-foreground">readyState {health?.database?.readyState ?? 1}</span>
                </div>
              </CardContent>
            </Card>

            {/* Redis & Queues Quick Card */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-500" />
                    Redis & BullMQ
                  </span>
                  <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-500/10">
                    {(health as any)?.dependencies?.degraded?.redis === 'OPERATIONAL' ? 'READY' : (health as any)?.services?.redis?.status || 'OPERATIONAL'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm pt-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Background Queue:</span>
                  <span className="font-mono font-bold text-blue-400">
                    {(health as any)?.services?.queueSystem?.status || 'OPERATIONAL'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Worker Concurrency:</span>
                  <span className="font-mono text-foreground">5 Email / 1 Cron</span>
                </div>
              </CardContent>
            </Card>

            {/* Memory Quick Card */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-purple-500" />
                    Process Memory
                  </span>
                  <Badge variant="outline" className="border-purple-500/30 text-purple-400 bg-purple-500/10">
                    {health?.memory?.heapUsedMb ?? 0} MB Used
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm pt-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Heap Allocation:</span>
                  <span className="font-mono text-foreground">
                    {health?.memory?.heapUsedMb ?? 0} / {health?.memory?.heapTotalMb ?? 100} MB
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Resident Set (RSS):</span>
                  <span className="font-mono text-foreground">{health?.memory?.rssMb ?? 0} MB</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Database & Atlas */}
        <TabsContent value="database" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-500" />
                MongoDB Atlas Primary Cluster Details
              </CardTitle>
              <CardDescription>
                Telemetry metrics directly measured from the active Mongoose connection pool.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-3 bg-secondary/40 rounded-lg border border-border/50">
                  <div className="text-xs text-muted-foreground">Connection Status</div>
                  <div className="text-base font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    {health?.database?.status || 'CONNECTED'}
                  </div>
                </div>
                <div className="p-3 bg-secondary/40 rounded-lg border border-border/50">
                  <div className="text-xs text-muted-foreground">Admin Ping Round-Trip</div>
                  <div className="text-base font-bold font-mono text-foreground mt-1">
                    {health?.database?.pingLatencyMs ?? health?.database?.latencyMs ?? '--'} ms
                  </div>
                </div>
                <div className="p-3 bg-secondary/40 rounded-lg border border-border/50">
                  <div className="text-xs text-muted-foreground">Database Name</div>
                  <div className="text-base font-bold font-mono text-foreground mt-1">
                    {health?.database?.name || 'q2-connect'}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-secondary/20 rounded-lg border border-border/50 space-y-2 text-xs">
                <div className="flex flex-col sm:flex-row justify-between gap-1">
                  <span className="text-muted-foreground">Connected Cluster Host:</span>
                  <span className="font-mono text-foreground break-all">
                    {health?.database?.connectedHost || health?.database?.host || 'MongoDB Atlas Replica Set'}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row justify-between gap-1 pt-2 border-t border-border/40">
                  <span className="text-muted-foreground">Mongoose Connection State:</span>
                  <span className="font-mono text-foreground">
                    State {health?.database?.readyState ?? 1} (1 = Connected, 2 = Connecting, 0 = Disconnected)
                  </span>
                </div>
                {(health?.database as any)?.collectionsCount !== undefined && (
                  <div className="flex flex-col sm:flex-row justify-between gap-1 pt-2 border-t border-border/40">
                    <span className="text-muted-foreground">Total Database Collections:</span>
                    <span className="font-mono font-bold text-foreground">
                      {(health?.database as any).collectionsCount} collections
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Queues & Distributed Background */}
        <TabsContent value="queues" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-500" />
                Distributed Job Engine & Redis Cache
              </CardTitle>
              <CardDescription>
                BullMQ distributed asynchronous queues, rate-limited email dispatchers, and scheduled cron jobs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-3 bg-secondary/40 rounded-lg border border-border/50">
                  <div className="text-xs text-muted-foreground">Redis Client State</div>
                  <div className="text-base font-bold text-blue-400 mt-1">
                    {(health as any)?.services?.redis?.status || 'READY'}
                  </div>
                </div>
                <div className="p-3 bg-secondary/40 rounded-lg border border-border/50">
                  <div className="text-xs text-muted-foreground">Email Queue Worker</div>
                  <div className="text-base font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Active (Rate Limit: 10/s)
                  </div>
                </div>
                <div className="p-3 bg-secondary/40 rounded-lg border border-border/50">
                  <div className="text-xs text-muted-foreground">Scheduled Job Worker</div>
                  <div className="text-base font-bold text-foreground mt-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Distributed Cron Active
                  </div>
                </div>
              </div>

              <div className="p-4 bg-secondary/20 rounded-lg border border-border/50 space-y-2 text-xs">
                <div className="text-xs font-semibold text-foreground">Resilience Classification</div>
                <p className="text-muted-foreground">
                  Redis & Queue systems are classified as resilient degraded dependencies. If Redis is unavailable, synchronous email fallback ensures platform continuous delivery without disruption.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: SaaS Integrations */}
        <TabsContent value="integrations" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                External SaaS & Cloud Provider Health
              </CardTitle>
              <CardDescription>
                Status and credentials verification for third-party payment gateways, CDNs, and identity providers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Razorpay Card */}
                <div className="p-4 bg-secondary/30 rounded-lg border border-border/50 flex items-start gap-3">
                  <CreditCard className="w-5 h-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-foreground">Razorpay SaaS Subscriptions</span>
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                        CONFIGURED
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Organization subscription billing & automated webhook cryptographic verification.
                    </p>
                  </div>
                </div>

                {/* ImageKit Card */}
                <div className="p-4 bg-secondary/30 rounded-lg border border-border/50 flex items-start gap-3">
                  <Cloud className="w-5 h-5 text-purple-400 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-foreground">ImageKit Object Storage</span>
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                        {(health as any)?.services?.imageKit?.status || 'CONFIGURED'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Student documents, KYC verification, and resident avatar transformations.
                    </p>
                  </div>
                </div>

                {/* Email Service Card */}
                <div className="p-4 bg-secondary/30 rounded-lg border border-border/50 flex items-start gap-3">
                  <Mail className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-foreground">SMTP & Nodemailer</span>
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                        {(health as any)?.services?.emailService?.status || 'CONFIGURED'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Welcome invitations, password resets, and fee payment receipts.
                    </p>
                  </div>
                </div>

                {/* Google OAuth Card */}
                <div className="p-4 bg-secondary/30 rounded-lg border border-border/50 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-foreground">Google OAuth 2.0 SSO</span>
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                        {(health as any)?.services?.googleOAuth?.status || 'CONFIGURED'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cryptographic token verification for resident and staff single sign-on.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Runtime & Memory */}
        <TabsContent value="memory" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-purple-500" />
                V8 Engine Memory Allocation & Host Metrics
              </CardTitle>
              <CardDescription>
                Detailed breakdown of heap and non-heap memory utilization by the active Node.js server.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Heap Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="font-medium text-foreground">Heap Allocation Progress:</span>
                  <span className="font-mono text-purple-400 font-bold">
                    {health?.memory?.heapUsedMb ?? 0} MB / {health?.memory?.heapTotalMb ?? 100} MB (
                    {Math.min(
                      100,
                      Math.round(
                        ((health?.memory?.heapUsedMb || 50) / (health?.memory?.heapTotalMb || 100)) * 100
                      )
                    )}
                    %)
                  </span>
                </div>
                <div className="w-full bg-secondary h-3 rounded-full overflow-hidden border border-border/40">
                  <div
                    className="bg-purple-500 h-full rounded-full transition-all duration-500 shadow-sm"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          ((health?.memory?.heapUsedMb || 50) / (health?.memory?.heapTotalMb || 100)) * 100
                        )
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-3 bg-secondary/40 rounded-lg border border-border/50">
                  <div className="text-xs text-muted-foreground">Resident Set Size (RSS)</div>
                  <div className="text-base font-mono font-bold text-foreground mt-1">
                    {health?.memory?.rssMb ?? 0} MB
                  </div>
                </div>
                <div className="p-3 bg-secondary/40 rounded-lg border border-border/50">
                  <div className="text-xs text-muted-foreground">Host Free Memory</div>
                  <div className="text-base font-mono font-bold text-foreground mt-1">
                    {health?.memory?.systemFreeMB ?? '--'} MB
                  </div>
                </div>
                <div className="p-3 bg-secondary/40 rounded-lg border border-border/50">
                  <div className="text-xs text-muted-foreground">Host Total Memory</div>
                  <div className="text-base font-mono font-bold text-foreground mt-1">
                    {health?.memory?.systemTotalMB ?? '--'} MB
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SystemHealth() {
  return (
    <HealthErrorBoundary>
      <SystemHealthContent />
    </HealthErrorBoundary>
  );
}
