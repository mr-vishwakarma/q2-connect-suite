import { useEffect, useState } from 'react';
import {
  TrendingUp,
  Building2,
  Users,
  DollarSign,
  PieChart,
  Bed,
  CreditCard,
  RefreshCw,
  BarChart3,
  ArrowUpRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { superAdminService } from '@/services/api/superAdmin.service';
import { DetailedAnalytics } from '@/types';
import { toast } from 'react-toastify';

export default function PlatformAnalytics() {
  const [data, setData] = useState<DetailedAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true);
      const res = await superAdminService.getDetailedAnalytics();
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (error) {
      console.error('Failed to load platform analytics:', error);
      toast.error('Failed to load platform analytics');
    } finally {
      setIsLoading(false);
    }
  };

  const overview = data?.overview;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Platform Analytics & Metrics</h1>
          <p className="text-sm text-muted-foreground">High-density SaaS business metrics, growth indicators, revenue ARR/MRR and capacity.</p>
        </div>
        <Button onClick={fetchAnalytics} variant="outline" size="sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Metrics
        </Button>
      </div>

      {/* Financial & Scale KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card-highlight">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-[#9295AD] uppercase tracking-wider">Monthly Recurring (MRR)</p>
              <h3 className="text-2xl font-semibold text-[#F0EFF8] mt-1 tabular-nums">
                ₹{(overview?.mrr || 0).toLocaleString('en-IN')}
              </h3>
              <p className="text-xs text-[#A78BFA] font-medium mt-1 flex items-center">
                <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                ARR: ₹{((overview?.arr || 0) / 100000).toFixed(1)} Lakhs
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-[#A78BFA]/12 border border-[#A78BFA]/25 flex items-center justify-center text-[#A78BFA]">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-highlight">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-[#9295AD] uppercase tracking-wider">Average Revenue Per Tenant</p>
              <h3 className="text-2xl font-semibold text-[#F0EFF8] mt-1 tabular-nums">
                ₹{(overview?.arpu || 0).toLocaleString('en-IN')}
              </h3>
              <p className="text-xs text-[#74788F] mt-1">ARPU across active tenants</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-[#74DCCB]/12 border border-[#74DCCB]/25 flex items-center justify-center text-[#74DCCB]">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-highlight">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-[#9295AD] uppercase tracking-wider">Total Active Tenants</p>
              <h3 className="text-2xl font-semibold text-[#F0EFF8] mt-1 tabular-nums">{overview?.activeOrgs ?? '--'}</h3>
              <p className="text-xs text-[#ED91C1] font-medium mt-1">
                {overview?.trialOrgs ?? 0} in trial / {overview?.totalOrgs ?? 0} total
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-[#ED91C1]/12 border border-[#ED91C1]/25 flex items-center justify-center text-[#ED91C1]">
              <Building2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-highlight">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-[#9295AD] uppercase tracking-wider">Global Occupancy Rate</p>
              <h3 className="text-2xl font-semibold text-[#F0EFF8] mt-1 tabular-nums">
                {overview ? `${overview.occupancyRate}%` : '--'}
              </h3>
              <p className="text-xs text-sky-400 font-medium mt-1">
                {overview?.totalOccupied ?? 0} / {overview?.totalCapacity ?? 0} Beds Occupied
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-sky-500/12 border border-sky-500/25 flex items-center justify-center text-sky-400">
              <Bed className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Growth Trend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#A78BFA]" />
              6-Month Platform Revenue &amp; Growth Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.monthlyTrends?.map((item) => (
                <div key={item.month} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#F0EFF8]">{item.month}</span>
                    <span className="text-[#9295AD] tabular-nums">
                      {item.organizations} Orgs &bull; {item.students} Students &bull; ₹{item.mrr.toLocaleString('en-IN')} MRR
                    </span>
                  </div>
                  <div className="w-full bg-white/[0.06] h-2.5 rounded-full overflow-hidden flex">
                    <div
                      className="bg-gradient-to-r from-[#8B6EF3] to-[#A78BFA] h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(8, ((item.mrr || 1000) / (overview?.mrr || 10000)) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Plan Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="w-4 h-4 text-[#74DCCB]" />
              SaaS Plan Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data?.planDistribution?.length === 0 ? (
              <p className="text-sm text-[#74788F] text-center py-6">No plan data available</p>
            ) : (
              data?.planDistribution?.map((plan) => {
                const total = overview?.totalOrgs || 1;
                const percent = Math.round((plan.count / total) * 100);
                return (
                  <div key={plan.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-[#F0EFF8]">{plan.name}</span>
                      <span className="text-xs text-[#9295AD] tabular-nums">
                        {plan.count} ({percent}%)
                      </span>
                    </div>
                    <div className="w-full bg-white/[0.06] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-[#74DCCB] to-[#A78BFA] h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(5, percent)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}

            <div className="pt-4 border-t border-white/[0.08] text-xs text-[#9295AD] space-y-1.5">
              <div className="flex justify-between">
                <span>Active Subscriptions:</span>
                <span className="font-semibold text-[#F0EFF8] tabular-nums">{overview?.activeSubCount ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Trial Subscriptions:</span>
                <span className="font-semibold text-[#F0EFF8] tabular-nums">{overview?.trialSubCount ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Past Due Subscriptions:</span>
                <span className="font-semibold text-rose-400 tabular-nums">{overview?.pastDueSubCount ?? 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
