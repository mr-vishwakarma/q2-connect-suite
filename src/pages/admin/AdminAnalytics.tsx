import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  Users, 
  Activity, 
  Server, 
  AlertTriangle,
  Cpu,
  Database,
  RefreshCw,
  TrendingUp,
  Box
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminAnalytics() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: async () => {
      const response = await api.get('/analytics');
      return response.data?.data;
    },
    refetchInterval: 30000 // Refetch every 30s
  });

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center p-8 text-destructive">Failed to load analytics data</div>;
  }

  const { database, sessions, system, api: apiStats } = data;

  const dbData = [
    { name: 'Students', value: database.totalStudents },
    { name: 'Rooms', value: database.totalRooms },
    { name: 'Complaints', value: database.totalComplaints },
    { name: 'Mess Requests', value: database.totalMessRequests },
  ];

  const methodData = Object.entries(apiStats.byMethod).map(([name, value]) => ({ name, value }));

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1">Real-time system monitoring and statistics</p>
        </div>
        <Button onClick={() => refetch()} variant="outline" className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Activity className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{sessions.active}</div>
            <p className="text-xs text-muted-foreground">Currently authenticated users</p>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{database.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Registered accounts</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">API Requests</CardTitle>
            <Server className="w-4 h-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{apiStats.totalRequests.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total API calls</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">API Errors</CardTitle>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{apiStats.errors.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Failed requests (4xx/5xx)</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Memory Usage */}
        <Card className="bg-card border-border col-span-1">
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
                  <span className="font-medium">{system.memory.heapUsed} MB / {system.memory.heapTotal} MB</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full" 
                    style={{ width: `${(system.memory.heapUsed / system.memory.heapTotal) * 100}%` }}
                  ></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground">RSS Memory</p>
                  <p className="font-semibold text-foreground">{system.memory.rss} MB</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">External</p>
                  <p className="font-semibold text-foreground">{system.memory.external} MB</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Uptime</p>
                  <p className="font-semibold text-foreground">
                    {Math.floor(system.uptime / 3600)}h {Math.floor((system.uptime % 3600) / 60)}m
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Platform</p>
                  <p className="font-semibold text-foreground">{system.platform} / {system.nodeVersion}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Database Stats */}
        <Card className="bg-card border-border col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              Database Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
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
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {dbData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Endpoints */}
        <Card className="bg-card border-border lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Top API Endpoints (Since Startup)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
                  <tr>
                    <th className="px-4 py-3 rounded-l-lg">Endpoint</th>
                    <th className="px-4 py-3 text-right rounded-r-lg">Requests</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(apiStats.byEndpoint).map(([endpoint, count]: [string, any], index) => (
                    <tr key={index} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{endpoint}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{count.toLocaleString()}</td>
                    </tr>
                  ))}
                  {Object.keys(apiStats.byEndpoint).length === 0 && (
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
      </div>
    </div>
  );
}
