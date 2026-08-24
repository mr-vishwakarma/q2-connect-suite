import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Users,
  CreditCard,
  DollarSign,
  TrendingUp,
  Activity,
  ArrowUpRight,
  ShieldAlert,
  GitFork,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { superAdminService } from '@/services/api/superAdmin.service';
import { SuperAdminDashboardStats } from '@/types';
import { Link } from 'react-router-dom';

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<SuperAdminDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      const res = await superAdminService.getDashboardStats();
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const kpis = [
    {
      title: 'Active Organizations',
      value: stats?.activeOrganizations ?? '--',
      subtitle: `${stats?.totalOrganizations || 0} Total Tenants`,
      icon: Building2,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10 border-amber-500/20',
    },
    {
      title: 'Total Hostel Branches',
      value: stats?.totalHostels ?? '--',
      subtitle: 'Across all organizations',
      icon: GitFork,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10 border-blue-500/20',
    },
    {
      title: 'Platform Students',
      value: stats?.totalStudents ?? '--',
      subtitle: `${stats?.totalRooms || 0} Total Rooms`,
      icon: Users,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      title: 'Monthly Recurring Revenue (MRR)',
      value: stats ? `₹${(stats.monthlyRecurringRevenue || 0).toLocaleString()}` : '--',
      subtitle: `ARR: ₹${((stats?.annualRecurringRevenue || 0) / 100000).toFixed(1)} Lakhs`,
      icon: DollarSign,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10 border-purple-500/20',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">SaaS Control Center</h1>
          <p className="text-sm text-muted-foreground">Real-time health, tenant growth, and platform revenue metrics.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild className="bg-amber-500 hover:bg-amber-600 text-black font-semibold">
            <Link to="/super-admin/organizations">
              <Building2 className="w-4 h-4 mr-2" />
              Onboard Organization
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => {
          const Icon = kpi.icon;
          return (
            <motion.div
              key={kpi.title}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="border border-border/60 bg-card hover:border-amber-500/40 transition-colors shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{kpi.title}</span>
                  <div className={`p-2 rounded-xl border ${kpi.bg}`}>
                    <Icon className={`w-4 h-4 ${kpi.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{kpi.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{kpi.subtitle}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Main Grid: Growth & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Platform Overview */}
        <Card className="lg:col-span-2 border-border/60">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              Platform Scale & Adoption
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-secondary/50 border border-border/50">
                <span className="text-xs text-muted-foreground block">Collection Efficiency</span>
                <span className="text-xl font-bold text-emerald-400">98.4%</span>
              </div>
              <div className="p-4 rounded-xl bg-secondary/50 border border-border/50">
                <span className="text-xs text-muted-foreground block">Trial Conversion Rate</span>
                <span className="text-xl font-bold text-amber-400">74.2%</span>
              </div>
              <div className="p-4 rounded-xl bg-secondary/50 border border-border/50 col-span-2 sm:col-span-1">
                <span className="text-xs text-muted-foreground block">Platform Uptime</span>
                <span className="text-xl font-bold text-blue-400">99.98%</span>
              </div>
            </div>

            <div className="pt-4 border-t border-border/50">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Quick Navigation</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Button variant="outline" size="sm" asChild className="justify-start">
                  <Link to="/super-admin/organizations">Organizations</Link>
                </Button>
                <Button variant="outline" size="sm" asChild className="justify-start">
                  <Link to="/super-admin/plans">Subscription Plans</Link>
                </Button>
                <Button variant="outline" size="sm" asChild className="justify-start">
                  <Link to="/super-admin/features">Feature Catalog</Link>
                </Button>
                <Button variant="outline" size="sm" asChild className="justify-start">
                  <Link to="/super-admin/audit-logs">Audit Logs</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Audit / Activity Feed */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-500" />
              Platform Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.recentActivity && stats.recentActivity.length > 0 ? (
                stats.recentActivity.slice(0, 6).map((item) => (
                  <div key={item.id} className="p-3 rounded-lg bg-secondary/30 border border-border/40 text-xs flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{item.action}</span>
                      <Badge variant="outline" className="text-[10px] py-0">{new Date(item.timestamp).toLocaleDateString()}</Badge>
                    </div>
                    <span className="text-muted-foreground text-[11px] truncate">{item.description}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-muted-foreground">No recent platform events recorded</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
