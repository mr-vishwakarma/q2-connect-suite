import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Plus,
  Search,
  ExternalLink,
  Ban,
  CheckCircle2,
  GitFork,
  Users,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { OnboardTenantModal } from '@/components/super-admin/OnboardTenantModal';
import { superAdminService } from '@/services/api/superAdmin.service';
import { Organization } from '@/types';
import { toast } from 'react-toastify';

interface PopulatedOrgSubscription {
  status?: string;
  billingCycle?: string;
  agreedPriceRupees?: number;
  activationMethod?: string;
  pricingSnapshot?: {
    planName?: string;
    agreedPriceRupees?: number;
  };
  planId?: {
    name?: string;
  } | string;
}

interface OrganizationListItem extends Omit<Organization, 'subscriptionId'> {
  roomCount?: number;
  subscriptionSummary?: {
    planName?: string;
    billingCycle?: string;
    agreedPriceRupees?: number;
    status?: string;
    activationMethod?: string;
  };
  subscriptionId?: string | PopulatedOrgSubscription;
}

export default function OrganizationList() {
  const [organizations, setOrganizations] = useState<OrganizationListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [suspendTargetOrg, setSuspendTargetOrg] = useState<OrganizationListItem | null>(null);
  const [isSuspendingAction, setIsSuspendingAction] = useState(false);

  // Debounce search input by 300ms
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1); // Reset to page 1 on new search
    }, 300);
  };

  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    setPage(1); // Reset to page 1 on new filter
  };

  const fetchOrganizations = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await superAdminService.getOrganizations({
        search: debouncedSearch.trim() || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        page,
        limit,
      });

      if (res.success && res.data) {
        if (Array.isArray(res.data)) {
          // Backward compatibility fallback
          setOrganizations(res.data);
          setTotalCount(res.data.length);
          setTotalPages(Math.ceil(res.data.length / limit) || 1);
        } else if ('organizations' in res.data && res.data.organizations) {
          const orgData = res.data.organizations;
          const pagination = res.data.pagination;
          setOrganizations(orgData);
          if (pagination) {
            setTotalCount(pagination.total || 0);
            setTotalPages(pagination.totalPages || 1);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
      toast.error('Failed to load organizations');
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, statusFilter, page, limit]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const handleConfirmSuspendToggle = async () => {
    if (!suspendTargetOrg) return;
    const isSuspending = suspendTargetOrg.status !== 'SUSPENDED';
    try {
      setIsSuspendingAction(true);
      const orgId = suspendTargetOrg._id || suspendTargetOrg.id;
      const res = await superAdminService.suspendOrganization(orgId, isSuspending);
      if (res.success) {
        toast.success(`Organization '${suspendTargetOrg.name}' ${isSuspending ? 'suspended' : 'activated'} successfully`);
        setSuspendTargetOrg(null);
        fetchOrganizations();
      }
    } catch (error) {
      toast.error('Failed to update organization status');
    } finally {
      setIsSuspendingAction(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Organizations (Tenants)</h1>
          <p className="text-sm text-muted-foreground">Manage tenant companies, branches, subscriptions and isolation.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold">
          <Plus className="w-4 h-4 mr-2" />
          Onboard New Tenant
        </Button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            placeholder="Search by name, slug or email..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>

        <div className="w-full sm:w-48">
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="bg-card border-border">
              <SelectValue placeholder="Status: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="TRIAL">Trial</SelectItem>
              <SelectItem value="PENDING_PAYMENT">Pending Payment</SelectItem>
              <SelectItem value="PAYMENT_FAILED">Payment Failed</SelectItem>
              <SelectItem value="EXPIRED">Expired</SelectItem>
              <SelectItem value="SUSPENDED">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tenants Table */}
      <Card className="bg-card border-border overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border/80 bg-secondary/30 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                  <th className="p-4">Organization</th>
                  <th className="p-4">Hostel Branches</th>
                  <th className="p-4">Residents & Rooms</th>
                  <th className="p-4">Plan & Billing</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                        <span>Loading organizations...</span>
                      </div>
                    </td>
                  </tr>
                ) : organizations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-muted-foreground">
                      <Building2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="font-semibold text-foreground">No organizations found</p>
                      <p className="text-xs mt-1">Try adjusting your search criteria or onboard a new tenant.</p>
                    </td>
                  </tr>
                ) : (
                  organizations.map((org) => {
                    const orgId = org._id || org.id;
                    const isSuspended = org.status === 'SUSPENDED';

                    return (
                      <tr
                        key={orgId}
                        className={`hover:bg-secondary/30 transition-colors ${
                          isSuspended ? 'bg-destructive/5' : ''
                        }`}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                              <Building2 className="w-5 h-5 text-amber-500" />
                            </div>
                            <div>
                              <Link
                                to={`/super-admin/organizations/${orgId}`}
                                className="font-semibold text-foreground hover:text-amber-400 transition-colors block"
                              >
                                {org.name}
                              </Link>
                              <div className="text-xs text-muted-foreground font-mono mt-0.5">
                                /{org.slug} &bull; {org.contactEmail}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="p-4">
                          <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                            <GitFork className="w-3.5 h-3.5 text-primary" />
                            <span>{org.hostelCount ?? 0} Branches</span>
                          </div>
                        </td>

                        <td className="p-4">
                          <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                            <Users className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>{org.studentCount ?? 0} Students &bull; {org.roomCount ?? 0} Rooms</span>
                          </div>
                        </td>

                        <td className="p-4">
                          {(() => {
                            const summary = org.subscriptionSummary;
                            const subObj =
                              typeof org.subscriptionId === 'object' && org.subscriptionId !== null
                                ? org.subscriptionId
                                : null;
                            const subPlanObj =
                              subObj?.planId && typeof subObj.planId === 'object' ? subObj.planId : null;
                            const planName =
                              summary?.planName ||
                              subObj?.pricingSnapshot?.planName ||
                              subPlanObj?.name ||
                              null;
                            const cycle = summary?.billingCycle || subObj?.billingCycle || 'MONTHLY';
                            const isYearly = String(cycle).toUpperCase() === 'YEARLY';
                            const agreedPrice =
                              summary?.agreedPriceRupees ??
                              subObj?.pricingSnapshot?.agreedPriceRupees ??
                              subObj?.agreedPriceRupees ??
                              null;
                            const subStatus = summary?.status || subObj?.status;
                            const activationMethod = summary?.activationMethod || subObj?.activationMethod;

                            return (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <Badge variant="outline" className="border-border text-xs font-semibold">
                                    {planName || 'Not Assigned'}
                                  </Badge>
                                  {subStatus && (
                                    <Badge variant="secondary" className="text-[10px]">
                                      {subStatus}
                                    </Badge>
                                  )}
                                </div>
                                {agreedPrice !== null && agreedPrice !== undefined && (
                                  <div className="text-[11px] font-mono text-muted-foreground">
                                    ₹{Number(agreedPrice).toLocaleString('en-IN')} / {isYearly ? 'yr' : 'mo'}
                                    {activationMethod && activationMethod !== 'PENDING'
                                      ? ` • ${activationMethod.replace('_', ' ')}`
                                      : ''}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        <td className="p-4">
                          <Badge
                            variant="outline"
                            className={
                              isSuspended || org.status === 'PAYMENT_FAILED' || org.status === 'EXPIRED'
                                ? 'border-destructive/40 text-destructive bg-destructive/10'
                                : org.status === 'ACTIVE'
                                ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                                : 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                            }
                          >
                            {org.status}
                          </Badge>
                        </td>

                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="outline" size="sm" asChild>
                              <Link to={`/super-admin/organizations/${orgId}`}>
                                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                                Manage
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSuspendTargetOrg(org)}
                              className={
                                isSuspended
                                  ? 'text-emerald-400 hover:text-emerald-300'
                                  : 'text-destructive hover:text-destructive/80'
                              }
                              title={isSuspended ? 'Activate Organization' : 'Suspend Organization'}
                            >
                              {isSuspended ? <CheckCircle2 className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Server-Side Pagination Bar */}
          {!isLoading && totalCount > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-border bg-secondary/10">
              <div className="text-xs text-muted-foreground font-mono">
                Showing{' '}
                <strong className="text-foreground">
                  {(page - 1) * limit + 1}
                </strong>{' '}
                to{' '}
                <strong className="text-foreground">
                  {Math.min(page * limit, totalCount)}
                </strong>{' '}
                of <strong className="text-foreground">{totalCount}</strong> organizations
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-8 px-2.5 text-xs"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground px-2 font-mono">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-8 px-2.5 text-xs"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog for Tenant Suspension / Activation */}
      <AlertDialog open={!!suspendTargetOrg} onOpenChange={(open) => !open && setSuspendTargetOrg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  suspendTargetOrg?.status === 'SUSPENDED'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-destructive/10 text-destructive'
                }`}
              >
                {suspendTargetOrg?.status === 'SUSPENDED' ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <AlertDialogTitle>
                {suspendTargetOrg?.status === 'SUSPENDED'
                  ? `Activate "${suspendTargetOrg?.name}"?`
                  : `Suspend "${suspendTargetOrg?.name}"?`}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="pt-2 text-sm">
              {suspendTargetOrg?.status === 'SUSPENDED' ? (
                <>
                  Activating this organization will restore portal access for its administrators, wardens, and students across all registered branches.
                </>
              ) : (
                <>
                  <strong className="text-destructive font-semibold">Critical Impact:</strong> Suspending this organization will immediately invalidate all active user sessions and refresh tokens. No students, staff, or administrators from this tenant will be allowed to log in until reactivated.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSuspendingAction}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSuspendToggle}
              disabled={isSuspendingAction}
              className={
                suspendTargetOrg?.status === 'SUSPENDED'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
              }
            >
              {isSuspendingAction
                ? 'Processing...'
                : suspendTargetOrg?.status === 'SUSPENDED'
                ? 'Yes, Activate Organization'
                : 'Yes, Suspend Organization'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Real-world Multi-Stage Onboarding Wizard Modal */}
      <OnboardTenantModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={fetchOrganizations}
      />
    </div>
  );
}
