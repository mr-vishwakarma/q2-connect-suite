import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { WidgetErrorBoundary } from '@/components/common/WidgetErrorBoundary';
import {
  Users,
  Activity,
  Server,
  AlertTriangle,
  Cpu,
  Database,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminAnalytics() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: async () => {
      const response = await api.get('/analytics');
      return response.data?.data;
    },
    refetchInterval: (query) => {
      // Stop polling if query encountered an error or if browser tab is hidden
      if (query.state.error) return false;
      if (typeof document !== 'undefined' && document.hidden) return false;
      return 30000;
    },
    refetchIntervalInBackground: false,
  });

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center max-w-md mx-auto mt-12 space-y-3">
        <p className="text-sm font-medium text-destructive">Failed to load analytics data</p>
        <Button type="button" variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  const database = data.database ?? {};
  const sessions = data.sessions ?? {};
  const system = data.system ?? {};
  const apiStats = data.api ?? {};
  const memory = system.memory ?? { heapUsed: 0, heapTotal: 1, rss: 0, external: 0 };
  const byEndpoint = (apiStats.byEndpoint || {}) as Record<string, number>;
  const uptimeSeconds = Number(system.uptime ?? 0);

  const dbData = [
    { name: 'Students', value: Number(database.totalStudents ?? 0) },
    { name: 'Rooms', value: Number(database.totalRooms ?? 0) },
    { name: 'Complaints', value: Number(database.totalComplaints ?? 0) },
    { name: 'Mess Requests', value: Number(database.totalMessRequests ?? 0) },
  ];

  const COLORS = ['#A78BFA', '#74DCCB', '#ED91C1', '#818CF8', '#60A5FA'];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">Real-time system monitoring and statistics</p>
        </div>
        <Button onClick={() => refetch()} variant="outline" className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Activity className="w-4 h-4 text-[#74DCCB]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground tabular-nums">{sessions.active ?? 0}</div>
            <p className="text-xs text-muted-foreground">Currently authenticated users</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="w-4 h-4 text-[#A78BFA]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground tabular-nums">{database.totalUsers ?? 0}</div>
            <p className="text-xs text-muted-foreground">Registered accounts</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">API Requests</CardTitle>
            <Server className="w-4 h-4 text-sky-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground tabular-nums">{Number(apiStats.totalRequests ?? 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total API calls</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">API Errors</CardTitle>
            <AlertTriangle className="w-4 h-4 text-[#ED91C1]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground tabular-nums">{Number(apiStats.errors ?? 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Failed requests (4xx/5xx)</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Memory Usage */}
        <Card className="glass-card col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-primary" />
              System Resources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Heap Used</span>
                  <span className="font-medium tabular-nums">{memory.heapUsed ?? 0} MB / {memory.heapTotal ?? 0} MB</span>
                </div>
                <div className="w-full bg-white/[0.06] rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, ((Number(memory.heapUsed ?? 0)) / (Number(memory.heapTotal) || 1)) * 100)}%` }}
                  ></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground">RSS Memory</p>
                  <p className="font-semibold text-foreground tabular-nums">{memory.rss ?? 0} MB</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">External</p>
                  <p className="font-semibold text-foreground tabular-nums">{memory.external ?? 0} MB</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Uptime</p>
                  <p className="font-semibold text-foreground tabular-nums">
                    {Math.floor(uptimeSeconds / 3600)}h {Math.floor((uptimeSeconds % 3600) / 60)}m
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Platform</p>
                  <p className="font-semibold text-foreground">{system.platform || 'linux'} / {system.nodeVersion || 'node'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Database Stats */}
        <WidgetErrorBoundary title="Database Overview">
        <Card className="glass-card col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              Database Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[250px] min-w-0">
            <ResponsiveContainer width="100%" height={210} minWidth={0}>
              <PieChart>
                <Pie
                  data={dbData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {dbData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(23, 25, 40, 0.94)', borderColor: 'rgba(225, 225, 255, 0.14)', borderRadius: '12px', color: '#F0EFF8' }}
                  itemStyle={{ color: '#F0EFF8' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        </WidgetErrorBoundary>

        {/* Top Endpoints */}
        <WidgetErrorBoundary title="Top API Endpoints">
        <Card className="glass-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Top API Endpoints (Since Startup)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-white/[0.04]">
                  <tr>
                    <th className="px-4 py-3 rounded-l-lg">Endpoint</th>
                    <th className="px-4 py-3 text-right rounded-r-lg">Requests</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(byEndpoint).map(([endpoint, count], index) => (
                    <tr key={index} className="border-b border-border last:border-0 hover:bg-white/[0.03] transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{endpoint}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">{Number(count).toLocaleString()}</td>
                    </tr>
                  ))}
                  {Object.keys(byEndpoint).length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">
                        No API requests tracked yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        </WidgetErrorBoundary>
      </div>
    </div>
  );
}
