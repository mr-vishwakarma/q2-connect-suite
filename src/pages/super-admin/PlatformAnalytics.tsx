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
        <Card className="bg-card/50 border-border/60">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Monthly Recurring (MRR)</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                ₹{(overview?.mrr || 0).toLocaleString()}
              </h3>
              <p className="text-xs text-purple-400 font-medium mt-1 flex items-center">
                <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                ARR: ₹{((overview?.arr || 0) / 100000).toFixed(1)} Lakhs
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/60">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Average Revenue Per Tenant</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                ₹{(overview?.arpu || 0).toLocaleString()}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">ARPU across active tenants</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/60">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Active Tenants</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{overview?.activeOrgs ?? '--'}</h3>
              <p className="text-xs text-amber-500 font-medium mt-1">
                {overview?.trialOrgs ?? 0} in trial / {overview?.totalOrgs ?? 0} total
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Building2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/60">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Global Occupancy Rate</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {overview ? `${overview.occupancyRate}%` : '--'}
              </h3>
              <p className="text-xs text-blue-400 font-medium mt-1">
                {overview?.totalOccupied ?? 0} / {overview?.totalCapacity ?? 0} Beds Occupied
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
              <Bed className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Growth Trend */}
        <Card className="bg-card border-border lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              6-Month Platform Revenue & Growth Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.monthlyTrends?.map((item) => (
                <div key={item.month} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">{item.month}</span>
                    <span className="text-muted-foreground">
                      {item.organizations} Orgs &bull; {item.students} Students &bull; ₹{item.mrr.toLocaleString()} MRR
                    </span>
                  </div>
                  <div className="w-full bg-secondary h-3 rounded-full overflow-hidden flex">
                    <div
                      className="bg-primary h-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(10, ((item.mrr || 1000) / (overview?.mrr || 10000)) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Plan Distribution */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="w-4 h-4 text-amber-500" />
              SaaS Plan Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data?.planDistribution?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No plan data available</p>
            ) : (
              data?.planDistribution?.map((plan) => {
                const total = overview?.totalOrgs || 1;
                const percent = Math.round((plan.count / total) * 100);
                return (
                  <div key={plan.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{plan.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {plan.count} ({percent}%)
                      </span>
                    </div>
                    <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(5, percent)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}

            <div className="pt-4 border-t border-border/60 text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Active Subscriptions:</span>
                <span className="font-semibold text-foreground">{overview?.activeSubCount ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Trial Subscriptions:</span>
                <span className="font-semibold text-foreground">{overview?.trialSubCount ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Past Due Subscriptions:</span>
                <span className="font-semibold text-red-400">{overview?.pastDueSubCount ?? 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
