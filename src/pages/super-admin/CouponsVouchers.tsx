import React, { useState, useEffect, useCallback } from 'react';
import {
  voucherService,
  Voucher,
  CreateVoucherPayload,
  CreateVoucherResponse,
  VoucherRedemptionItem,
} from '@/services/api/voucher.service';
import { billingService, SaaSPlan } from '@/services/api/billing.service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Ticket,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldAlert,
  Copy,
  Download,
  Eye,
  PauseCircle,
  PlayCircle,
  XCircle,
  IndianRupee,
  Calendar,
  Building2,
  Loader2,
  Lock,
  Key,
  ShieldCheck,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'react-toastify';
import { api } from '@/lib/api';

export default function CouponsVouchers() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [organizations, setOrganizations] = useState<{ _id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [activeTab, setActiveTab] = useState('vouchers');

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  // Redemptions Report State
  const [redemptions, setRedemptions] = useState<VoucherRedemptionItem[]>([]);
  const [redemptionsLoading, setRedemptionsLoading] = useState(false);
  const [redemptionsTotal, setRedemptionsTotal] = useState(0);

  // Create Voucher Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [formData, setFormData] = useState<CreateVoucherPayload>({
    name: '',
    description: '',
    discountAmountRupees: 2000,
    eligiblePlans: [],
    eligibleBillingIntervals: ['MONTHLY'],
    validFrom: new Date().toISOString().slice(0, 16),
    expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 16),
    globalRedemptionLimit: 1,
    maxRedemptionsPerOrg: 1,
    scope: 'GLOBAL',
    restrictedToOrgIds: [],
    subscriptionEligibility: 'ALL',
    discountDurationCycles: 1,
    minSubscriptionAmountRupees: 0,
    internalNotes: '',
  });

  // One-Time Credentials Modal State
  const [credentialsModal, setCredentialsModal] = useState<CreateVoucherResponse | null>(null);

  // View Details Modal State
  const [selectedVoucherDetails, setSelectedVoucherDetails] = useState<(Voucher & { redemptions: VoucherRedemptionItem[] }) | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);

  // Fetch Vouchers List
  const fetchVouchers = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { page, limit: 20 };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const response = await voucherService.getVouchers(params);
      setVouchers(response.data || []);
      setTotalCount(response.pagination?.total || 0);
    } catch (err: any) {
      console.error('Error fetching vouchers:', err);
      toast.error(err.message || 'Failed to load vouchers');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, searchQuery]);

  // Fetch Redemptions Report
  const fetchRedemptions = useCallback(async () => {
    try {
      setRedemptionsLoading(true);
      const response = await voucherService.getRedemptionsReport({ limit: 50 });
      setRedemptions(response.data || []);
      setRedemptionsTotal(response.pagination?.total || 0);
    } catch (err: any) {
      console.error('Error fetching redemptions report:', err);
      toast.error('Failed to load redemptions report');
    } finally {
      setRedemptionsLoading(false);
    }
  }, []);

  // Fetch Plans & Orgs for Form Selectors
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [plansData, orgsRes] = await Promise.all([
          billingService.getPlans(),
          api.get('/super-admin/organizations?limit=100').catch(() => ({ data: { data: [] } })),
        ]);
        setPlans(plansData);
        setOrganizations(orgsRes.data?.data || []);
      } catch (err) {
        console.warn('Metadata fetch notice:', err);
      }
    };
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchVouchers();
  }, [fetchVouchers]);

  useEffect(() => {
    if (activeTab === 'redemptions') {
      fetchRedemptions();
    }
  }, [activeTab, fetchRedemptions]);

  // Handle Create Voucher Submission
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Please enter a voucher name');
      return;
    }
    if (Number(formData.discountAmountRupees) <= 0) {
      toast.error('Discount amount must be greater than ₹0');
      return;
    }
    if (new Date(formData.expiresAt) <= new Date(formData.validFrom || Date.now())) {
      toast.error('Expiry date must be after validity start date');
      return;
    }

    try {
      setIsSubmittingCreate(true);
      const result = await voucherService.createVoucher(formData);
      setIsCreateOpen(false);
      setCredentialsModal(result);
      toast.success('Voucher created successfully! Secure credentials now.');
      fetchVouchers();
    } catch (err: any) {
      console.error('Create voucher error:', err);
      toast.error(err.response?.data?.message || err.message || 'Failed to create voucher');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Status Change (Activate, Suspend, Revoke)
  const handleStatusChange = async (voucherId: string, targetStatus: 'ACTIVE' | 'SUSPENDED' | 'REVOKED') => {
    const confirmMsg =
      targetStatus === 'REVOKED'
        ? 'Are you sure you want to PERMANENTLY REVOKE this voucher? It cannot be redeemed again.'
        : `Change voucher status to ${targetStatus}?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await voucherService.updateVoucherStatus(voucherId, targetStatus);
      toast.success(`Voucher status updated to ${targetStatus}`);
      fetchVouchers();
      if (selectedVoucherDetails?._id === voucherId) {
        setSelectedVoucherDetails((prev) => (prev ? { ...prev, status: targetStatus } : null));
      }
    } catch (err: any) {
      console.error('Status change error:', err);
      toast.error(err.response?.data?.message || err.message || 'Failed to update voucher status');
    }
  };

  // View Voucher Details
  const handleViewDetails = async (id: string) => {
    try {
      setIsDetailsLoading(true);
      const details = await voucherService.getVoucherById(id);
      setSelectedVoucherDetails(details);
    } catch (err: any) {
      console.error('Fetch details error:', err);
      toast.error('Failed to load voucher details');
    } finally {
      setIsDetailsLoading(false);
    }
  };

  // Copy to clipboard helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  // Download Credentials as Safe File
  const downloadCredentials = () => {
    if (!credentialsModal) return;
    const content = `================================================
HOSTELIQ — SECURE VOUCHER CREDENTIALS
================================================
Voucher Name: ${credentialsModal.voucher.name}
Reference ID: ${credentialsModal.voucher.reference}
Discount Amount: ₹${credentialsModal.voucher.discountAmountRupees.toLocaleString('en-IN')}
Expiry Date: ${new Date(credentialsModal.voucher.expiresAt).toLocaleString('en-IN')}

VOUCHER CODE: ${credentialsModal.credentials.code}
SECRET PIN:   ${credentialsModal.credentials.pin}

IMPORTANT NOTICE:
This is the ONLY time these credentials will be shown.
The secret PIN is hashed on the server and CANNOT be recovered.
Distribute directly to the authorized organization administrator.
================================================`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${credentialsModal.voucher.reference}_credentials.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Credentials downloaded securely');
  };

  const getStatusBadge = (status: string, effectiveStatus?: string) => {
    const active = effectiveStatus || status;
    switch (active) {
      case 'ACTIVE':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Active</Badge>;
      case 'DRAFT':
        return <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30">Draft</Badge>;
      case 'SUSPENDED':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Suspended</Badge>;
      case 'EXPIRED':
        return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Expired</Badge>;
      case 'EXHAUSTED':
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Exhausted</Badge>;
      case 'REVOKED':
        return <Badge variant="destructive">Revoked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Metrics computation
  const activeCount = vouchers.filter((v) => (v.effectiveStatus || v.status) === 'ACTIVE').length;
  const totalRedeemedCount = vouchers.reduce((acc, v) => acc + (v.currentRedemptionCount || 0), 0);
  const totalDiscountGranted = vouchers.reduce(
    (acc, v) => acc + (v.currentRedemptionCount || 0) * (v.discountAmountRupees || 0),
    0
  );

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Ticket className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Coupons & Subscription Vouchers
              </h1>
              <p className="text-sm text-muted-foreground">
                Issue, configure, audit, and monitor SaaS subscription discounts with separate secret PIN verification.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchVouchers()}
            disabled={loading}
            className="h-10"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            onClick={() => setIsCreateOpen(true)}
            className="h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Voucher
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Campaigns
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{totalCount}</h3>
              <p className="text-xs text-muted-foreground mt-1">Configured voucher records</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center justify-center">
              <Ticket className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Active Vouchers
              </p>
              <h3 className="text-2xl font-bold text-emerald-500 mt-1">{activeCount}</h3>
              <p className="text-xs text-muted-foreground mt-1">Currently eligible for checkout</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center">
              <PlayCircle className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Redemptions
              </p>
              <h3 className="text-2xl font-bold text-purple-500 mt-1">{totalRedeemedCount}</h3>
              <p className="text-xs text-muted-foreground mt-1">Successful tenant activations</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Discount Granted
              </p>
              <h3 className="text-2xl font-bold text-primary mt-1 flex items-center">
                <IndianRupee className="w-5 h-5 mr-0.5 inline" />
                {totalDiscountGranted.toLocaleString('en-IN')}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Direct SaaS fee savings</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs: Vouchers List vs Redemptions Report */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <TabsList className="bg-muted/60 p-1 rounded-xl">
            <TabsTrigger value="vouchers" className="rounded-lg data-[state=active]:bg-card">
              <Ticket className="w-4 h-4 mr-2" />
              Voucher Campaigns ({totalCount})
            </TabsTrigger>
            <TabsTrigger value="redemptions" className="rounded-lg data-[state=active]:bg-card">
              <FileText className="w-4 h-4 mr-2" />
              Redemptions History ({redemptionsTotal})
            </TabsTrigger>
          </TabsList>

          {activeTab === 'vouchers' && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search name, code, ref..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              <select
                aria-label="Filter vouchers by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 px-3 text-xs rounded-lg border border-input bg-card text-foreground"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="EXPIRED">Expired</option>
                <option value="EXHAUSTED">Exhausted</option>
                <option value="REVOKED">Revoked</option>
              </select>
            </div>
          )}
        </div>

        {/* Tab 1: Vouchers Table */}
        <TabsContent value="vouchers" className="space-y-4 m-0">
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center min-h-[300px]">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : vouchers.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-muted/40 mx-auto flex items-center justify-center text-muted-foreground">
                    <Ticket className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-semibold text-foreground">No Vouchers Found</h4>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    {searchQuery || statusFilter !== 'ALL'
                      ? 'No vouchers match your filter criteria. Try resetting filters.'
                      : 'Create your first subscription coupon or promotional voucher to get started.'}
                  </p>
                  <Button onClick={() => setIsCreateOpen(true)} size="sm">
                    <Plus className="w-4 h-4 mr-1.5" /> Create Voucher
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="font-semibold text-foreground">Voucher & Ref</TableHead>
                        <TableHead className="font-semibold text-foreground">Masked Code</TableHead>
                        <TableHead className="font-semibold text-foreground">Discount</TableHead>
                        <TableHead className="font-semibold text-foreground">Plans & Intervals</TableHead>
                        <TableHead className="font-semibold text-foreground">Validity Period</TableHead>
                        <TableHead className="font-semibold text-foreground">Redemptions</TableHead>
                        <TableHead className="font-semibold text-foreground">Scope</TableHead>
                        <TableHead className="font-semibold text-foreground">Status</TableHead>
                        <TableHead className="text-right font-semibold text-foreground">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vouchers.map((v) => {
                        const effectiveStatus = v.effectiveStatus || v.status;
                        return (
                          <TableRow key={v._id} className="border-border hover:bg-muted/30">
                            <TableCell>
                              <div>
                                <p className="font-semibold text-foreground text-sm">{v.name}</p>
                                <span className="font-mono text-[11px] text-muted-foreground">
                                  {v.reference}
                                </span>
                              </div>
                            </TableCell>

                            <TableCell>
                              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted/50 border border-border">
                                {v.codeMasked}
                              </span>
                            </TableCell>

                            <TableCell>
                              <span className="font-bold text-foreground text-sm flex items-center">
                                <IndianRupee className="w-3.5 h-3.5 mr-0.5 inline" />
                                {v.discountAmountRupees.toLocaleString('en-IN')}
                              </span>
                            </TableCell>

                            <TableCell>
                              <div className="space-y-1">
                                <p className="text-xs text-foreground font-medium">
                                  {v.eligiblePlans && v.eligiblePlans.length > 0
                                    ? v.eligiblePlans.map((p) => p.name).join(', ')
                                    : 'All Active Plans'}
                                </p>
                                <div className="flex gap-1">
                                  {v.eligibleBillingIntervals?.length ? (
                                    v.eligibleBillingIntervals.map((interval) => (
                                      <Badge key={interval} variant="outline" className="text-[10px] py-0 px-1.5">
                                        {interval}
                                      </Badge>
                                    ))
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                                      ALL CYCLES
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="text-xs space-y-0.5">
                                <p className="text-muted-foreground">
                                  Until {format(parseISO(v.expiresAt), 'dd MMM yyyy')}
                                </p>
                                <span className="text-[10px] text-muted-foreground/80">
                                  From {format(parseISO(v.validFrom), 'dd MMM yyyy')}
                                </span>
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="space-y-1">
                                <span className="text-xs font-semibold text-foreground">
                                  {v.currentRedemptionCount} / {v.globalRedemptionLimit}
                                </span>
                                <div className="w-20 bg-muted/50 h-1.5 rounded-full overflow-hidden">
                                  <div
                                    className="bg-primary h-full rounded-full"
                                    style={{
                                      width: `${Math.min(
                                        100,
                                        (v.currentRedemptionCount / v.globalRedemptionLimit) * 100
                                      )}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </TableCell>

                            <TableCell>
                              <Badge variant="outline" className="text-[11px] font-normal">
                                {v.scope === 'GLOBAL' ? 'Global' : 'Restricted'}
                              </Badge>
                            </TableCell>

                            <TableCell>
                              {getStatusBadge(v.status, effectiveStatus)}
                            </TableCell>

                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  title="View Details & Redemptions"
                                  onClick={() => handleViewDetails(v._id)}
                                >
                                  <Eye className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                                </Button>

                                {effectiveStatus === 'SUSPENDED' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-emerald-400 hover:text-emerald-300"
                                    title="Reactivate Voucher"
                                    onClick={() => handleStatusChange(v._id, 'ACTIVE')}
                                  >
                                    <PlayCircle className="w-4 h-4" />
                                  </Button>
                                )}

                                {effectiveStatus === 'ACTIVE' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-amber-400 hover:text-amber-300"
                                    title="Suspend Voucher"
                                    onClick={() => handleStatusChange(v._id, 'SUSPENDED')}
                                  >
                                    <PauseCircle className="w-4 h-4" />
                                  </Button>
                                )}

                                {effectiveStatus !== 'REVOKED' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-rose-500 hover:text-rose-400"
                                    title="Revoke Voucher Permanently"
                                    onClick={() => handleStatusChange(v._id, 'REVOKED')}
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Redemptions Report Table */}
        <TabsContent value="redemptions" className="space-y-4 m-0">
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold">Historical Voucher Redemptions</CardTitle>
              <CardDescription>
                Authoritative record of all successful coupon activations and discount settlements.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {redemptionsLoading ? (
                <div className="flex items-center justify-center min-h-[250px]">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : redemptions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  No redemptions recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="font-semibold text-foreground">Voucher</TableHead>
                        <TableHead className="font-semibold text-foreground">Organization</TableHead>
                        <TableHead className="font-semibold text-foreground">Plan & Interval</TableHead>
                        <TableHead className="font-semibold text-foreground">Original Price</TableHead>
                        <TableHead className="font-semibold text-foreground">Discount</TableHead>
                        <TableHead className="font-semibold text-foreground">Final Payable</TableHead>
                        <TableHead className="font-semibold text-foreground">Invoice #</TableHead>
                        <TableHead className="font-semibold text-foreground">Redeemed At</TableHead>
                        <TableHead className="font-semibold text-foreground">Redeemed By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {redemptions.map((r) => (
                        <TableRow key={r._id} className="border-border hover:bg-muted/30">
                          <TableCell>
                            <div>
                              <p className="font-semibold text-foreground text-xs">{r.voucherId?.name}</p>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {r.voucherId?.reference}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell>
                            <span className="font-medium text-foreground text-xs">
                              {r.organizationId?.name || 'Organization'}
                            </span>
                          </TableCell>

                          <TableCell>
                            <span className="text-xs text-foreground font-medium">
                              {r.planId?.name} ({r.billingCycle})
                            </span>
                          </TableCell>

                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              ₹{r.originalAmountRupees?.toLocaleString('en-IN')}
                            </span>
                          </TableCell>

                          <TableCell>
                            <span className="text-xs font-semibold text-emerald-400">
                              -₹{r.discountAmountRupees?.toLocaleString('en-IN')}
                            </span>
                          </TableCell>

                          <TableCell>
                            <span className="text-xs font-bold text-foreground">
                              {r.finalPayableRupees === 0 ? (
                                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                                  ₹0 (Free)
                                </Badge>
                              ) : (
                                `₹${r.finalPayableRupees?.toLocaleString('en-IN')}`
                              )}
                            </span>
                          </TableCell>

                          <TableCell>
                            <span className="font-mono text-xs text-muted-foreground">
                              {r.invoiceId?.invoiceNumber || '—'}
                            </span>
                          </TableCell>

                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {r.redeemedAt ? format(parseISO(r.redeemedAt), 'dd MMM yyyy HH:mm') : '—'}
                            </span>
                          </TableCell>

                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {r.redeemedBy?.name || r.redeemedBy?.email || 'Admin'}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL 1: Create Voucher Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto bg-card border-border rounded-2xl p-6 shadow-2xl animate-fade-in">
          <DialogHeader>
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-1">
              <Ticket className="w-5 h-5" />
            </div>
            <DialogTitle className="text-xl font-bold text-foreground">Create Subscription Voucher</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure a promotional coupon granting a fixed INR discount on SaaS subscriptions.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold">Voucher / Campaign Name *</Label>
                <Input
                  required
                  placeholder="e.g. Hosteliq Launch Special ₹2,000"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold">Internal Description</Label>
                <Textarea
                  rows={2}
                  placeholder="Administrative purpose or promotional campaign notes"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Fixed Discount Amount (₹) *</Label>
                <Input
                  type="number"
                  required
                  min="1"
                  step="1"
                  value={formData.discountAmountRupees}
                  onChange={(e) => setFormData({ ...formData, discountAmountRupees: Number(e.target.value) })}
                  className="h-9 text-xs font-mono font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Discount Duration (Billing Cycles)</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={formData.discountDurationCycles}
                  onChange={(e) => setFormData({ ...formData, discountDurationCycles: Number(e.target.value) })}
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Valid From *</Label>
                <Input
                  type="datetime-local"
                  required
                  value={formData.validFrom}
                  onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Expires At *</Label>
                <Input
                  type="datetime-local"
                  required
                  value={formData.expiresAt}
                  onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Global Redemption Limit *</Label>
                <Input
                  type="number"
                  required
                  min="1"
                  step="1"
                  value={formData.globalRedemptionLimit}
                  onChange={(e) => setFormData({ ...formData, globalRedemptionLimit: Number(e.target.value) })}
                  className="h-9 text-xs font-mono"
                />
                <span className="text-[10px] text-muted-foreground">Total permitted across all hostels</span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Max Uses Per Organization *</Label>
                <Input
                  type="number"
                  required
                  min="1"
                  step="1"
                  value={formData.maxRedemptionsPerOrg}
                  onChange={(e) => setFormData({ ...formData, maxRedemptionsPerOrg: Number(e.target.value) })}
                  className="h-9 text-xs font-mono"
                />
                <span className="text-[10px] text-muted-foreground">Default 1 per organization</span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Eligible Billing Interval</Label>
                <select
                  aria-label="Eligible Billing Interval"
                  value={
                    formData.eligibleBillingIntervals?.length === 1
                      ? formData.eligibleBillingIntervals[0]
                      : 'BOTH'
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData({
                      ...formData,
                      eligibleBillingIntervals: val === 'BOTH' ? ['MONTHLY', 'YEARLY'] : [val as any],
                    });
                  }}
                  className="w-full h-9 px-3 text-xs rounded-lg border border-input bg-card text-foreground"
                >
                  <option value="BOTH">Both Monthly & Yearly</option>
                  <option value="MONTHLY">Monthly Only</option>
                  <option value="YEARLY">Yearly Only</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Organization Targeting Scope</Label>
                <select
                  aria-label="Organization Targeting Scope"
                  value={formData.scope}
                  onChange={(e) => setFormData({ ...formData, scope: e.target.value as any })}
                  className="w-full h-9 px-3 text-xs rounded-lg border border-input bg-card text-foreground"
                >
                  <option value="GLOBAL">Global (Any Eligible Organization)</option>
                  <option value="SELECTED_ORGANIZATIONS">Restricted to Selected Organizations</option>
                </select>
              </div>

              {formData.scope === 'SELECTED_ORGANIZATIONS' && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-semibold">Restricted Organizations</Label>
                  <select
                    aria-label="Restricted Organizations"
                    multiple
                    value={formData.restrictedToOrgIds}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                      setFormData({ ...formData, restrictedToOrgIds: selected });
                    }}
                    className="w-full h-24 p-2 text-xs rounded-lg border border-input bg-card text-foreground"
                  >
                    {organizations.map((org) => (
                      <option key={org._id} value={org._id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-muted-foreground">Hold Ctrl / Cmd to select multiple organizations</span>
                </div>
              )}

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold">Eligible Plans (Leave empty to allow all plans)</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2 rounded-lg border border-border bg-muted/20">
                  {plans.map((p) => {
                    const isChecked = formData.eligiblePlans?.includes(p._id);
                    return (
                      <label key={p._id} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const newPlans = e.target.checked
                              ? [...(formData.eligiblePlans || []), p._id]
                              : (formData.eligiblePlans || []).filter((id) => id !== p._id);
                            setFormData({ ...formData, eligiblePlans: newPlans });
                          }}
                          className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                        />
                        <span className="font-medium">{p.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmittingCreate}
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmittingCreate} className="font-semibold">
                {isSubmittingCreate ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating Cryptographic Voucher...
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4 mr-2" />
                    Generate & Secure Voucher
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: One-Time Credential Reveal Dialog */}
      {credentialsModal && (
        <Dialog open={Boolean(credentialsModal)} onOpenChange={() => setCredentialsModal(null)}>
          <DialogContent className="sm:max-w-[500px] bg-card border-border rounded-2xl p-6 shadow-2xl animate-fade-in">
            <DialogHeader className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <DialogTitle className="text-xl font-bold text-foreground">
                Voucher Credentials Generated
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Copy and store these credentials now. The secret PIN will{' '}
                <strong className="text-foreground">NEVER</strong> be displayed again.
              </DialogDescription>
            </DialogHeader>

            <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-3 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>
                <strong>Warning:</strong> The raw PIN is securely hashed using scrypt. Once you close this modal, the original PIN cannot be recovered.
              </span>
            </div>

            <div className="bg-muted/40 border border-border/80 rounded-xl p-4 space-y-4 my-2">
              {/* Voucher Code */}
              <div>
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  16-Character Voucher Code
                </Label>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <span className="font-mono text-lg font-extrabold tracking-wider text-primary select-all">
                    {credentialsModal.credentials.code}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs font-medium"
                    onClick={() => copyToClipboard(credentialsModal.credentials.code, 'Voucher Code')}
                  >
                    <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                  </Button>
                </div>
              </div>

              {/* Secret PIN */}
              <div className="border-t border-border/80 pt-3">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  6-Digit Secret PIN
                </Label>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <span className="font-mono text-2xl font-black tracking-widest text-emerald-400 select-all">
                    {credentialsModal.credentials.pin}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs font-medium"
                    onClick={() => copyToClipboard(credentialsModal.credentials.pin, 'PIN')}
                  >
                    <Copy className="w-3.5 h-3.5 mr-1" /> Copy PIN
                  </Button>
                </div>
              </div>

              {/* Campaign summary */}
              <div className="border-t border-border/80 pt-3 text-xs space-y-1 text-muted-foreground">
                <div className="flex justify-between">
                  <span>Campaign:</span>
                  <span className="font-semibold text-foreground">{credentialsModal.voucher.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Reference ID:</span>
                  <span className="font-mono text-foreground">{credentialsModal.voucher.reference}</span>
                </div>
                <div className="flex justify-between">
                  <span>Discount Value:</span>
                  <span className="font-bold text-foreground">
                    ₹{credentialsModal.voucher.discountAmountRupees.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={downloadCredentials}
              >
                <Download className="w-4 h-4 mr-2" /> Download Credentials TXT
              </Button>
              <Button
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                onClick={() => setCredentialsModal(null)}
              >
                I Have Saved The Credentials
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL 3: Voucher Details & Specific Redemptions Dialog */}
      {selectedVoucherDetails && (
        <Dialog open={Boolean(selectedVoucherDetails)} onOpenChange={() => setSelectedVoucherDetails(null)}>
          <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto bg-card border-border rounded-2xl p-6 shadow-2xl animate-fade-in">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-xl font-bold text-foreground">
                    {selectedVoucherDetails.name}
                  </DialogTitle>
                  <span className="font-mono text-xs text-muted-foreground">
                    Reference: {selectedVoucherDetails.reference}
                  </span>
                </div>
                {getStatusBadge(selectedVoucherDetails.status, selectedVoucherDetails.effectiveStatus)}
              </div>
            </DialogHeader>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-4 p-4 rounded-xl bg-muted/30 border border-border text-xs">
              <div>
                <span className="text-muted-foreground">Masked Code</span>
                <p className="font-mono font-bold text-foreground mt-0.5">{selectedVoucherDetails.codeMasked}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Discount Amount</span>
                <p className="font-bold text-foreground mt-0.5">
                  ₹{selectedVoucherDetails.discountAmountRupees.toLocaleString('en-IN')}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Redemptions</span>
                <p className="font-bold text-foreground mt-0.5">
                  {selectedVoucherDetails.currentRedemptionCount} / {selectedVoucherDetails.globalRedemptionLimit}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Max Per Org</span>
                <p className="font-bold text-foreground mt-0.5">{selectedVoucherDetails.maxRedemptionsPerOrg}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Valid From</span>
                <p className="text-foreground mt-0.5">
                  {format(parseISO(selectedVoucherDetails.validFrom), 'dd MMM yyyy')}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Expires At</span>
                <p className="text-foreground mt-0.5">
                  {format(parseISO(selectedVoucherDetails.expiresAt), 'dd MMM yyyy')}
                </p>
              </div>
            </div>

            {/* Redemptions for this voucher */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-foreground">Redemption History for this Voucher</h4>
              {selectedVoucherDetails.redemptions?.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No organizations have redeemed this voucher yet.
                </p>
              ) : (
                <div className="border border-border rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent text-[11px]">
                        <TableHead>Organization</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Payable</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedVoucherDetails.redemptions.map((r) => (
                        <TableRow key={r._id} className="border-border text-xs">
                          <TableCell className="font-medium text-foreground">{r.organizationId?.name}</TableCell>
                          <TableCell>{r.planId?.name} ({r.billingCycle})</TableCell>
                          <TableCell className="font-bold">
                            {r.finalPayableRupees === 0 ? '₹0 (Free)' : `₹${r.finalPayableRupees}`}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(parseISO(r.redeemedAt), 'dd MMM yyyy')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <DialogFooter className="pt-4 border-t border-border flex justify-between">
              <div className="flex gap-2">
                {selectedVoucherDetails.status === 'ACTIVE' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-amber-400 border-amber-500/30"
                    onClick={() => handleStatusChange(selectedVoucherDetails._id, 'SUSPENDED')}
                  >
                    <PauseCircle className="w-4 h-4 mr-1.5" /> Suspend
                  </Button>
                )}
                {selectedVoucherDetails.status === 'SUSPENDED' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-emerald-400 border-emerald-500/30"
                    onClick={() => handleStatusChange(selectedVoucherDetails._id, 'ACTIVE')}
                  >
                    <PlayCircle className="w-4 h-4 mr-1.5" /> Reactivate
                  </Button>
                )}
                {selectedVoucherDetails.status !== 'REVOKED' && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleStatusChange(selectedVoucherDetails._id, 'REVOKED')}
                  >
                    <XCircle className="w-4 h-4 mr-1.5" /> Revoke
                  </Button>
                )}
              </div>
              <Button variant="outline" onClick={() => setSelectedVoucherDetails(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
