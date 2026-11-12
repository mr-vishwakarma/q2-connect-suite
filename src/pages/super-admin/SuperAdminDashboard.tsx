import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Users,
  DollarSign,
  TrendingUp,
  Activity,
  GitFork,
  ArrowUpRight,
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
  const [loadError, setLoadError] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(false);
      const res = await superAdminService.getDashboardStats();
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const kpis = useMemo(
    () => [
      {
        title: 'Active Organizations',
        value: isLoading ? '--' : stats?.activeOrganizations ?? 0,
        subtitle: `${stats?.totalOrganizations || 0} Total Tenants`,
        icon: Building2,
        color: 'text-[#A78BFA]',
        bg: 'bg-[#A78BFA]/10 border-[#A78BFA]/20',
      },
      {
        title: 'Total Hostel Branches',
        value: isLoading ? '--' : stats?.totalHostels ?? 0,
        subtitle: 'Across all organizations',
        icon: GitFork,
        color: 'text-sky-400',
        bg: 'bg-sky-500/10 border-sky-500/20',
      },
      {
        title: 'Platform Students',
        value: isLoading ? '--' : stats?.totalStudents ?? 0,
        subtitle: `${stats?.totalRooms || 0} Total Rooms`,
        icon: Users,
        color: 'text-[#74DCCB]',
        bg: 'bg-[#74DCCB]/10 border-[#74DCCB]/20',
      },
      {
        title: 'Monthly Recurring (MRR)',
        value: stats ? `₹${(stats.monthlyRecurringRevenue || 0).toLocaleString('en-IN')}` : '--',
        subtitle: `ARR: ₹${((stats?.annualRecurringRevenue || 0) / 100000).toFixed(1)} Lakhs`,
        icon: DollarSign,
        color: 'text-[#ED91C1]',
        bg: 'bg-[#ED91C1]/10 border-[#ED91C1]/20',
      },
    ],
    [stats, isLoading]
  );

  const activeOrgRatio =
    stats && stats.totalOrganizations > 0
      ? `${Math.round((stats.activeOrganizations / stats.totalOrganizations) * 100)}%`
      : '—';

  const avgStudentsPerHostel =
    stats && stats.totalHostels > 0
      ? `${Math.round(stats.totalStudents / stats.totalHostels)}`
      : '—';

  const totalArrDisplay = stats
    ? `₹${Number(stats.annualRecurringRevenue || 0).toLocaleString('en-IN')}`
    : '—';

  return (
    <div className="space-y-6">
      {/* Header with Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#F0EFF8]">
            SaaS Control Center
          </h1>
          <p className="text-sm text-[#9295AD] mt-1">
            Real-time health, tenant growth, and platform revenue metrics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {loadError && (
            <Button variant="outline" size="sm" onClick={fetchStats}>
              Retry Metrics
            </Button>
          )}
          <Button asChild>
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
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
            >
              <Card className="glass-card-highlight hover:border-white/[0.15] transition-colors">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <span className="text-[11px] font-semibold text-[#9295AD] uppercase tracking-wider">
                    {kpi.title}
                  </span>
                  <div className={`p-2 rounded-xl border ${kpi.bg}`}>
                    <Icon className={`w-4 h-4 ${kpi.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold text-[#F0EFF8] tabular-nums">{kpi.value}</div>
                  <p className="text-xs text-[#74788F] mt-1">{kpi.subtitle}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Main Grid: Growth & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Platform Overview */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#A78BFA]" />
              Platform Scale &amp; Adoption
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                <span className="text-xs text-[#9295AD] block">Active Tenant Ratio</span>
                <span className="text-xl font-semibold text-[#74DCCB] tabular-nums mt-1 block">
                  {activeOrgRatio}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                <span className="text-xs text-[#9295AD] block">Avg Residents / Branch</span>
                <span className="text-xl font-semibold text-[#A78BFA] tabular-nums mt-1 block">
                  {avgStudentsPerHostel}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.07] col-span-2 sm:col-span-1">
                <span className="text-xs text-[#9295AD] block">Annual Run Rate (ARR)</span>
                <span className="text-xl font-semibold text-[#F0EFF8] tabular-nums mt-1 block truncate">
                  {totalArrDisplay}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-white/[0.07]">
              <h4 className="text-[11px] font-semibold text-[#74788F] uppercase tracking-wider mb-3">
                Quick Navigation
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <Button variant="outline" size="sm" asChild className="justify-between">
                  <Link to="/super-admin/organizations">
                    Organizations
                    <ArrowUpRight className="w-3.5 h-3.5 text-[#74788F]" />
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild className="justify-between">
                  <Link to="/super-admin/plans">
                    Subscription Plans
                    <ArrowUpRight className="w-3.5 h-3.5 text-[#74788F]" />
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild className="justify-between">
                  <Link to="/super-admin/vouchers">
                    Vouchers
                    <ArrowUpRight className="w-3.5 h-3.5 text-[#74788F]" />
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild className="justify-between">
                  <Link to="/super-admin/audit-logs">
                    Audit Logs
                    <ArrowUpRight className="w-3.5 h-3.5 text-[#74788F]" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Audit / Activity Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#74DCCB]" />
              Platform Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.recentActivity && stats.recentActivity.length > 0 ? (
                stats.recentActivity.slice(0, 6).map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07] text-xs flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#F0EFF8] truncate">{item.action}</span>
                      <Badge variant="outline" className="text-[10px] py-0 shrink-0">
                        {item.timestamp && !Number.isNaN(Date.parse(item.timestamp))
                          ? new Date(item.timestamp).toLocaleDateString()
                          : 'Recent'}
                      </Badge>
                    </div>
                    <span className="text-[#9295AD] text-[11px] truncate">{item.description}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-xs text-[#74788F]">
                  No recent platform events recorded
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
