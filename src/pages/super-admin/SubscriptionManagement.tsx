import { useEffect, useState, useCallback } from 'react';
import {
  Search,
  Building2,
  AlertTriangle,
  RefreshCw,
  Eye,
  X,
  Ticket,
  IndianRupee,
  Clock,
  ArrowRightLeft,
  History,
  FileText,
  Loader2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  superAdminService,
  SaasSubscriptionRecord,
  SubscriptionInspectData,
  PopulatedOrganizationRef,
  PopulatedPlanRef,
  SaasPaymentRecord,
  SaasInvoiceRecord,
  SaasVoucherRedemptionRecord,
} from '@/services/api/superAdmin.service';
import { ScheduledPlanChange } from '@/types';
import { toast } from 'react-toastify';
import { getErrorMessage } from '@/utils/errorHandling';

import { useDebounce } from '@/hooks/useDebounce';

function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10';
    case 'TRIAL':
      return 'border-amber-500/30 text-amber-400 bg-amber-500/10';
    case 'PENDING_PAYMENT':
    case 'CREATED':
      return 'border-blue-500/30 text-blue-400 bg-blue-500/10';
    case 'PAYMENT_FAILED':
    case 'PAST_DUE':
    case 'SUSPENDED':
      return 'border-red-500/30 text-red-400 bg-red-500/10';
    case 'EXPIRED':
    case 'CANCELLED':
    default:
      return 'border-zinc-500/30 text-zinc-400 bg-zinc-500/10';
  }
}

function getActivationBadge(method?: string) {
  const m = String(method || 'PENDING').toUpperCase();
  switch (m) {
    case 'ONLINE_PAYMENT':
      return (
        <Badge variant="outline" className="text-[10px] border-indigo-500/30 text-indigo-400 bg-indigo-500/10">
          Online Payment
        </Badge>
      );
    case 'VOUCHER':
      return (
        <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-400 bg-purple-500/10">
          Voucher
        </Badge>
      );
    case 'FREE_TRIAL':
      return (
        <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400 bg-amber-500/10">
          Free Trial
        </Badge>
      );
    case 'ADMIN_OVERRIDE':
      return (
        <Badge variant="outline" className="text-[10px] border-cyan-500/30 text-cyan-400 bg-cyan-500/10">
          Admin Activated
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-[10px] border-zinc-500/30 text-zinc-400">
          Pending Activation
        </Badge>
      );
  }
}

export default function SubscriptionManagement() {
  const [subscriptions, setSubscriptions] = useState<SaasSubscriptionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [activationMethodFilter, setActivationMethodFilter] = useState('ALL');
  const [hasScheduledChangeOnly, setHasScheduledChangeOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 20 });
  const [extendingSub, setExtendingSub] = useState<SaasSubscriptionRecord | null>(null);
  const [extendDays, setExtendDays] = useState(14);

  // Inspect details modal state
  const [inspectOpen, setInspectOpen] = useState(false);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectData, setInspectData] = useState<SubscriptionInspectData | null>(null);

  const fetchSubscriptions = useCallback(async (page = 1, signal?: AbortSignal) => {
    try {
      setIsLoading(true);
      const params: Parameters<typeof superAdminService.getSubscriptions>[0] = { page, limit: 20 };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (activationMethodFilter !== 'ALL') params.activationMethod = activationMethodFilter;
      if (hasScheduledChangeOnly) params.hasScheduledChange = 'true';
      if (debouncedSearch) params.search = debouncedSearch;

      const res = await superAdminService.getSubscriptions(params, { signal });
      if (res.success && res.data) {
        setSubscriptions(res.data.subscriptions || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      }
    } catch (error: unknown) {
      const isCanceled =
        typeof error === 'object' &&
        error !== null &&
        ((error as { name?: string }).name === 'CanceledError' ||
          (error as { code?: string }).code === 'ERR_CANCELED');
      if (isCanceled) return;
      console.error('Failed to load subscriptions:', error);
      toast.error('Failed to load subscriptions');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, activationMethodFilter, hasScheduledChangeOnly, debouncedSearch]);

  useEffect(() => {
    const controller = new AbortController();
    fetchSubscriptions(currentPage, controller.signal);
    return () => {
      controller.abort();
    };
  }, [currentPage, fetchSubscriptions]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const handleInspectSubscription = async (subId: string) => {
    try {
      setInspectOpen(true);
      setInspectLoading(true);
      const res = await superAdminService.getSubscriptionById(subId);
      if (res.success && res.data) {
        setInspectData(res.data);
      } else {
        toast.error('Failed to load subscription details');
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to load subscription details'));
    } finally {
      setInspectLoading(false);
    }
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
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to extend trial'));
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
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to update status'));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Subscriptions &amp; Billing</h1>
          <p className="text-sm text-muted-foreground">
            Monitor tenant plan assignments, agreed price snapshots, activation methods, near-expiry alerts, and scheduled downgrades.
          </p>
        </div>
        <Button onClick={() => fetchSubscriptions(currentPage)} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            placeholder="Search by organization, plan, or voucher ref..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9 bg-card"
          />
        </form>

        <select
          aria-label="Filter by subscription status"
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
          <option value="NEAR_EXPIRY">Near Expiry</option>
          <option value="PENDING_PAYMENT">Pending Payment</option>
          <option value="PAYMENT_FAILED">Payment Failed</option>
          <option value="PAST_DUE">Past Due</option>
          <option value="EXPIRED">Expired</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="SUSPENDED">Suspended</option>
        </select>

        <select
          aria-label="Filter by activation method"
          value={activationMethodFilter}
          onChange={(e) => {
            setActivationMethodFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="h-10 px-3 rounded-md bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="ALL">All Activation Methods</option>
          <option value="ONLINE_PAYMENT">Online Payment</option>
          <option value="VOUCHER">Voucher</option>
          <option value="FREE_TRIAL">Free Trial</option>
          <option value="ADMIN_OVERRIDE">Admin Override</option>
          <option value="PENDING">Pending</option>
        </select>

        <label className="inline-flex items-center gap-2 h-10 px-3 rounded-md bg-card border border-border text-xs font-medium text-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hasScheduledChangeOnly}
            onChange={(e) => {
              setHasScheduledChangeOnly(e.target.checked);
              setCurrentPage(1);
            }}
            className="rounded border-border text-primary focus:ring-primary"
          />
          Scheduled Plan Change Only
        </label>
      </div>

      {/* Table */}
      <Card className="bg-card border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/40 border-b border-border text-xs uppercase text-muted-foreground font-semibold">
              <tr>
                <th className="px-5 py-3.5">Tenant Organization</th>
                <th className="px-5 py-3.5">Assigned Plan &amp; Snapshot</th>
                <th className="px-5 py-3.5">Cycle &amp; Activation</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Period / Trial Dates</th>
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
              ) : subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                    <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2 opacity-60" />
                    No subscriptions match your filter criteria.
                  </td>
                </tr>
              ) : (
                subscriptions.map((sub) => {
                  const snap = sub.pricingSnapshot;
                  const planObj =
                    sub.planId && typeof sub.planId === 'object' ? (sub.planId as PopulatedPlanRef) : null;
                  const orgObj =
                    sub.organizationId && typeof sub.organizationId === 'object'
                      ? (sub.organizationId as PopulatedOrganizationRef)
                      : null;
                  const planName = snap?.planName || planObj?.name || 'Not Assigned';
                  const cycle = snap?.billingCycle || sub.billingCycle || 'MONTHLY';
                  const isYearly = String(cycle).toUpperCase() === 'YEARLY';
                  const agreedPrice =
                    snap?.agreedPriceRupees ??
                    sub.agreedPriceRupees ??
                    (isYearly ? planObj?.priceYearly : planObj?.priceMonthly);

                  return (
                    <tr key={sub._id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span>{orgObj?.name || 'Unknown Organization'}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{orgObj?.contactEmail}</div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-semibold text-foreground">{planName}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {agreedPrice !== undefined && agreedPrice !== null
                            ? `₹${Number(agreedPrice).toLocaleString('en-IN')} / ${isYearly ? 'yr' : 'mo'}`
                            : 'No price snapshot'}
                        </div>
                        {sub.scheduledPlanChange?.status === 'SCHEDULED' && (
                          <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <ArrowRightLeft className="w-3 h-3" />
                            Next: {sub.scheduledPlanChange.targetPlanName}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1 items-start">
                          <Badge variant="outline" className="border-border text-foreground text-[11px]">
                            {cycle}
                          </Badge>
                          {getActivationBadge(sub.activationMethod)}
                          {sub.lastVoucherReference && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                              <Ticket className="w-3 h-3" /> {sub.lastVoucherReference}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-col items-start gap-1">
                          <Badge variant="outline" className={getStatusBadgeClass(sub.status)}>
                            {sub.status}
                          </Badge>
                          {sub.nearExpiry?.isNearExpiry && (
                            <Badge variant="destructive" className="text-[10px]">
                              <Clock className="w-3 h-3 mr-1" />
                              {sub.nearExpiry.daysRemaining}d left
                            </Badge>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-xs text-muted-foreground">
                        {sub.status === 'TRIAL' ? (
                          <>
                            <div>
                              Trial Start:{' '}
                              {sub.trialStartsAt
                                ? new Date(sub.trialStartsAt).toLocaleDateString('en-IN')
                                : sub.currentPeriodStart
                                ? new Date(sub.currentPeriodStart).toLocaleDateString('en-IN')
                                : 'N/A'}
                            </div>
                            <div className="text-amber-400 font-medium">
                              Trial End:{' '}
                              {sub.trialEndsAt
                                ? new Date(sub.trialEndsAt).toLocaleDateString('en-IN')
                                : sub.currentPeriodEnd
                                ? new Date(sub.currentPeriodEnd).toLocaleDateString('en-IN')
                                : 'N/A'}
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              Start: {sub.currentPeriodStart ? new Date(sub.currentPeriodStart).toLocaleDateString('en-IN') : 'N/A'}
                            </div>
                            <div>
                              End: {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString('en-IN') : 'N/A'}
                            </div>
                          </>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => handleInspectSubscription(sub._id)}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Inspect
                          </Button>
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
                  );
                })
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
              Extend trial for{' '}
              <strong className="text-foreground">
                {typeof extendingSub.organizationId === 'object' && extendingSub.organizationId !== null
                  ? extendingSub.organizationId.name
                  : ''}
              </strong>.
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

      {/* Inspect Subscription Detail Modal */}
      {inspectOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-amber-400" />
                  {typeof inspectData?.subscription?.organizationId === 'object' &&
                  inspectData.subscription.organizationId !== null
                    ? inspectData.subscription.organizationId.name || 'Subscription Audit Inspection'
                    : 'Subscription Audit Inspection'}
                </h3>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  {typeof inspectData?.subscription?.organizationId === 'object' &&
                  inspectData.subscription.organizationId !== null
                    ? inspectData.subscription.organizationId.contactEmail
                    : ''}
                  {inspectData?.subscription?._id ? ` • Sub ID: ${inspectData.subscription._id}` : ''}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setInspectOpen(false);
                  setInspectData(null);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {inspectLoading || !inspectData ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-xs">Loading authoritative subscription details...</span>
              </div>
            ) : (
              (() => {
                const sub = inspectData.subscription;
                const snap = sub.pricingSnapshot;
                const subPlanObj =
                  sub.planId && typeof sub.planId === 'object' ? (sub.planId as PopulatedPlanRef) : null;
                const limits = snap?.limits || subPlanObj?.limits;
                const maxStudents = limits?.maxStudents ?? 0;
                const maxHostels = limits?.maxHostels ?? 0;
                const maxRooms = limits?.maxRooms ?? 0;
                const usage = sub.usage || {};

                return (
                  <div className="space-y-5 text-xs">
                    {/* Snapshot & Status Overview */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3.5 rounded-xl bg-secondary/30 border border-border">
                        <span className="text-muted-foreground block mb-1">Pricing Snapshot</span>
                        <div className="text-sm font-bold text-foreground">
                          {snap?.planName || subPlanObj?.name || 'Not Assigned'}
                        </div>
                        <div className="font-mono text-emerald-400 font-semibold mt-0.5">
                          ₹{Number(snap?.agreedPriceRupees ?? sub.agreedPriceRupees ?? 0).toLocaleString('en-IN')} /{' '}
                          {(snap?.billingCycle || sub.billingCycle) === 'YEARLY' ? 'yr' : 'mo'}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          Source: {snap?.source || 'ONBOARDING'}
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-secondary/30 border border-border">
                        <span className="text-muted-foreground block mb-1">Lifecycle &amp; Activation</span>
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <Badge variant="outline" className={getStatusBadgeClass(sub.status)}>
                            {sub.status}
                          </Badge>
                          {getActivationBadge(sub.activationMethod)}
                        </div>
                        {sub.lastVoucherReference && (
                          <div className="font-mono text-muted-foreground">Voucher: {sub.lastVoucherReference}</div>
                        )}
                        <div className="text-muted-foreground mt-1">
                          Period End:{' '}
                          {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString('en-IN') : 'N/A'}
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-secondary/30 border border-border">
                        <span className="text-muted-foreground block mb-1">Live Tenant Usage vs Limits</span>
                        <div>
                          Students: <strong>{usage.studentCount ?? 0}</strong> /{' '}
                          {maxStudents > 0 ? maxStudents : 'Unlimited'}
                        </div>
                        <div>
                          Hostels: <strong>{usage.hostelCount ?? 0}</strong> /{' '}
                          {maxHostels > 0 ? maxHostels : 'Unlimited'}
                        </div>
                        <div>
                          Rooms: <strong>{usage.roomCount ?? 0}</strong> /{' '}
                          {maxRooms > 0 ? maxRooms : 'Unlimited'}
                        </div>
                      </div>
                    </div>

                    {/* Scheduled Plan Change */}
                    {sub.scheduledPlanChange?.status === 'SCHEDULED' && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center justify-between gap-2">
                        <div>
                          <strong>Scheduled Plan Change:</strong> Switching to{' '}
                          <strong>{sub.scheduledPlanChange.targetPlanName}</strong> (
                          {sub.scheduledPlanChange.targetBillingCycle ||
                            (sub.scheduledPlanChange as ScheduledPlanChange & { billingCycle?: string }).billingCycle}
                          ) at ₹{Number(sub.scheduledPlanChange.targetPriceRupees || 0).toLocaleString('en-IN')}
                        </div>
                        <span className="font-mono">
                          Effective:{' '}
                          {sub.scheduledPlanChange.effectiveDate
                            ? new Date(sub.scheduledPlanChange.effectiveDate).toLocaleDateString('en-IN')
                            : 'Next Renewal'}
                        </span>
                      </div>
                    )}

                    {/* Payments */}
                    <div className="space-y-2">
                      <h4 className="font-bold text-foreground flex items-center gap-1.5">
                        <IndianRupee className="w-3.5 h-3.5 text-emerald-400" />
                        SaaS Payment Attempts ({inspectData.payments?.length || 0})
                      </h4>
                      {inspectData.payments?.length ? (
                        <div className="border border-border rounded-xl overflow-hidden">
                          <table className="w-full text-left">
                            <thead className="bg-secondary/30 text-[11px] uppercase text-muted-foreground">
                              <tr>
                                <th className="px-3 py-2">Date</th>
                                <th className="px-3 py-2">Plan</th>
                                <th className="px-3 py-2">Amount</th>
                                <th className="px-3 py-2">Status</th>
                                <th className="px-3 py-2">Gateway / Notes</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                              {inspectData.payments.map((p: SaasPaymentRecord) => (
                                <tr key={p._id}>
                                  <td className="px-3 py-2">{new Date(p.createdAt).toLocaleDateString('en-IN')}</td>
                                  <td className="px-3 py-2">{p.planId?.name || 'Plan'}</td>
                                  <td className="px-3 py-2 font-mono font-semibold">
                                    ₹{Number(p.amount || 0).toLocaleString('en-IN')}
                                  </td>
                                  <td className="px-3 py-2">
                                    <Badge variant="outline" className="text-[10px]">
                                      {p.status}
                                    </Badge>
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {p.razorpayPaymentId || p.failureReason || p.orderId || '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No gateway payment records recorded.</p>
                      )}
                    </div>

                    {/* Invoices & Vouchers */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <h4 className="font-bold text-foreground flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-blue-400" />
                          SaaS Invoices ({inspectData.invoices?.length || 0})
                        </h4>
                        {inspectData.invoices?.length ? (
                          <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {inspectData.invoices.map((inv: SaasInvoiceRecord) => (
                              <div
                                key={inv._id}
                                className="p-2.5 rounded-lg bg-secondary/20 border border-border flex items-center justify-between"
                              >
                                <div>
                                  <div className="font-mono font-semibold text-foreground">{inv.invoiceNumber}</div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {inv.planName} • {new Date(inv.createdAt).toLocaleDateString('en-IN')}
                                  </div>
                                </div>
                                <div className="text-right font-mono font-bold text-emerald-400">
                                  ₹{Number(inv.amountPaidRupees ?? 0).toLocaleString('en-IN')}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted-foreground">No SaaS invoices generated.</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-bold text-foreground flex items-center gap-1.5">
                          <Ticket className="w-3.5 h-3.5 text-purple-400" />
                          Voucher Redemptions ({inspectData.voucherRedemptions?.length || 0})
                        </h4>
                        {inspectData.voucherRedemptions?.length ? (
                          <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {inspectData.voucherRedemptions.map((vr: SaasVoucherRedemptionRecord) => (
                              <div
                                key={vr._id}
                                className="p-2.5 rounded-lg bg-secondary/20 border border-border flex items-center justify-between"
                              >
                                <div>
                                  <div className="font-semibold text-foreground">
                                    {vr.voucherId?.name || 'Voucher'} ({vr.voucherId?.reference})
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {vr.planId?.name} ({vr.billingCycle})
                                  </div>
                                </div>
                                <div className="font-mono font-semibold text-foreground">
                                  ₹{Number(vr.finalPayableRupees ?? 0).toLocaleString('en-IN')}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted-foreground">No voucher redemptions recorded.</p>
                        )}
                      </div>
                    </div>

                    {/* Lifecycle History */}
                    {((sub.history?.length ?? 0) > 0 || (sub.subscriptionHistory?.length ?? 0) > 0) && (
                      <div className="space-y-2">
                        <h4 className="font-bold text-foreground flex items-center gap-1.5">
                          <History className="w-3.5 h-3.5 text-amber-400" />
                          Subscription Lifecycle Audit Trail
                        </h4>
                        <div className="space-y-1.5 max-h-44 overflow-y-auto border border-border rounded-xl p-2.5 bg-secondary/10">
                          {[...(sub.history || sub.subscriptionHistory || [])].reverse().map((h, idx: number) => (
                            <div key={idx} className="flex items-start justify-between gap-2 pb-1.5 border-b border-border/40 last:border-b-0 last:pb-0">
                              <div>
                                <span className="font-semibold text-foreground">{h.eventType || h.action}</span>
                                <span className="text-muted-foreground ml-1.5">
                                  ({h.toPlanName || h.fromPlanName || 'Plan'} • {h.toStatus})
                                </span>
                                {(h.notes || h.reason) && (
                                  <div className="text-[11px] text-muted-foreground">{h.notes || h.reason}</div>
                                )}
                              </div>
                              <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                                {h.createdAt ? new Date(h.createdAt).toLocaleString('en-IN') : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}
    </div>
  );
}
