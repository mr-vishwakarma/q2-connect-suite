import { useEffect, useState } from 'react';
import {
  CreditCard,
  Search,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  PlusCircle,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { superAdminService } from '@/services/api/superAdmin.service';
import { toast } from 'react-toastify';

export default function SubscriptionManagement() {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 20 });
  const [extendingSub, setExtendingSub] = useState<any | null>(null);
  const [extendDays, setExtendDays] = useState(14);

  useEffect(() => {
    fetchSubscriptions(currentPage);
  }, [currentPage, statusFilter]);

  const fetchSubscriptions = async (page = 1) => {
    try {
      setIsLoading(true);
      const params: any = { page, limit: 20 };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (searchTerm) params.search = searchTerm;

      const res = await superAdminService.getSubscriptions(params);
      if (res.success && res.data) {
        setSubscriptions(res.data.subscriptions || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      }
    } catch (error) {
      console.error('Failed to load subscriptions:', error);
      toast.error('Failed to load subscriptions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchSubscriptions(1);
  };

  const handleExtendTrial = async () => {
    if (!extendingSub) return;
    try {
      const res = await superAdminService.extendSubscriptionTrial(extendingSub._id, extendDays);
      if (res.success) {
        toast.success(`Trial extended by ${extendDays} days`);
        setExtendingSub(null);
        fetchSubscriptions(currentPage);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to extend trial');
    }
  };

  const handleUpdateStatus = async (subId: string, newStatus: string) => {
    if (!confirm(`Update subscription status to ${newStatus}?`)) return;
    try {
      const res = await superAdminService.updateSubscription(subId, { status: newStatus });
      if (res.success) {
        toast.success(`Subscription marked as ${newStatus}`);
        fetchSubscriptions(currentPage);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update status');
    }
  };

  const filteredSubs = subscriptions.filter((s) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (s.organizationId?.name && s.organizationId.name.toLowerCase().includes(term)) ||
      (s.planId?.name && s.planId.name.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Subscriptions & Billing</h1>
          <p className="text-sm text-muted-foreground">Monitor tenant subscriptions, lifecycle statuses, trial extensions, and renewal dates.</p>
        </div>
        <Button onClick={() => fetchSubscriptions(currentPage)} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            placeholder="Search subscriptions by organization or plan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-card"
          />
        </form>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="h-10 px-3 rounded-md bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="TRIAL">Trial</option>
          <option value="PAST_DUE">Past Due</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>

      {/* Table */}
      <Card className="bg-card border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/40 border-b border-border text-xs uppercase text-muted-foreground font-semibold">
              <tr>
                <th className="px-5 py-3.5">Tenant Organization</th>
                <th className="px-5 py-3.5">Subscribed Plan</th>
                <th className="px-5 py-3.5">Billing Cycle</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Period Dates</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                      Loading subscriptions...
                    </div>
                  </td>
                </tr>
              ) : filteredSubs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                    <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2 opacity-60" />
                    No subscriptions found.
                  </td>
                </tr>
              ) : (
                filteredSubs.map((sub) => (
                  <tr key={sub._id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        {sub.organizationId?.name || 'Unknown Organization'}
                      </div>
                      <div className="text-xs text-muted-foreground">{sub.organizationId?.contactEmail}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-foreground">{sub.planId?.name || 'Custom Plan'}</div>
                      <div className="text-xs text-muted-foreground">
                        ₹{(sub.planId?.priceMonthly || 0).toLocaleString()} / mo
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant="outline" className="border-border text-foreground">
                        {sub.billingCycle || 'MONTHLY'}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <Badge
                        variant="outline"
                        className={
                          sub.status === 'ACTIVE'
                            ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                            : sub.status === 'TRIAL'
                            ? 'border-amber-500/30 text-amber-400 bg-amber-500/10'
                            : sub.status === 'PAST_DUE'
                            ? 'border-red-500/30 text-red-400 bg-red-500/10'
                            : 'border-zinc-500/30 text-zinc-400 bg-zinc-500/10'
                        }
                      >
                        {sub.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">
                      <div>Start: {sub.currentPeriodStart ? new Date(sub.currentPeriodStart).toLocaleDateString() : 'N/A'}</div>
                      <div>End: {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : 'N/A'}</div>
                      {sub.trialEndsAt && sub.status === 'TRIAL' && (
                        <div className="text-amber-400 font-medium">
                          Trial ends: {new Date(sub.trialEndsAt).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {sub.status === 'TRIAL' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                            onClick={() => setExtendingSub(sub)}
                          >
                            + Extend
                          </Button>
                        )}
                        {sub.status !== 'ACTIVE' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-emerald-400 hover:bg-emerald-500/10"
                            onClick={() => handleUpdateStatus(sub._id, 'ACTIVE')}
                          >
                            Activate
                          </Button>
                        )}
                        {sub.status === 'ACTIVE' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-red-400 hover:bg-red-500/10"
                            onClick={() => handleUpdateStatus(sub._id, 'PAST_DUE')}
                          >
                            Mark Past Due
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="px-5 py-4 border-t border-border flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Showing Page {currentPage} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= pagination.totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(pagination.totalPages, prev + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Extend Trial Modal */}
      {extendingSub && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-foreground">Extend Trial Period</h3>
            <p className="text-sm text-muted-foreground">
              Extend trial for <strong className="text-foreground">{extendingSub.organizationId?.name}</strong>.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Extension Days</label>
              <select
                value={extendDays}
                onChange={(e) => setExtendDays(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value={7}>+7 Days (1 Week)</option>
                <option value={14}>+14 Days (2 Weeks)</option>
                <option value={30}>+30 Days (1 Month)</option>
                <option value={60}>+60 Days (2 Months)</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setExtendingSub(null)}>
                Cancel
              </Button>
              <Button onClick={handleExtendTrial} className="bg-primary text-primary-foreground">
                Confirm Extension
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
