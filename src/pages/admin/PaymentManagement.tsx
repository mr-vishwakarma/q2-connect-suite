import { useState, useEffect, useCallback } from 'react';
import { paymentService, PaymentRecord } from '@/services/api/payment.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  CreditCard,
  Search,
  Filter,
  Receipt,
  RotateCcw,
  Clock,
  CheckCircle2,
  AlertCircle,
  IndianRupee,
  Calendar,
  Loader2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'react-toastify';

export default function PaymentManagement() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPayments, setTotalPayments] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Refund Dialog State
  const [selectedPaymentForRefund, setSelectedPaymentForRefund] = useState<PaymentRecord | null>(null);
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [refundReason, setRefundReason] = useState<string>('');
  const [refunding, setRefunding] = useState(false);

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { page, limit: 15 };
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      const res = await paymentService.getPayments(params);
      setPayments(res.data);
      setTotalPages(res.totalPages);
      setTotalPayments(res.total);
    } catch (err: any) {
      console.error('Error fetching payments:', err);
      toast.error(err.message || 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleOpenRefund = (payment: PaymentRecord) => {
    setSelectedPaymentForRefund(payment);
    const maxRefundable = payment.amountRupees - (payment.refundedAmountRupees || 0);
    setRefundAmount(maxRefundable.toString());
    setRefundReason('');
  };

  const handleExecuteRefund = async () => {
    if (!selectedPaymentForRefund) return;
    try {
      setRefunding(true);
      await paymentService.refundPayment(selectedPaymentForRefund._id, {
        amountRupees: parseFloat(refundAmount),
        reason: refundReason || 'Administrative refund',
      });
      toast.success('Refund processed successfully and ledger updated');
      setSelectedPaymentForRefund(null);
      await fetchPayments();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to process refund');
    } finally {
      setRefunding(false);
    }
  };

  const filteredPayments = payments.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const studentName = p.studentId?.name?.toLowerCase() || '';
    const username = p.studentId?.username?.toLowerCase() || '';
    const orderId = p.orderId?.toLowerCase() || '';
    const paymentId = p.paymentId?.toLowerCase() || '';
    const receiptNo = p.receiptNo?.toLowerCase() || '';
    return (
      studentName.includes(q) ||
      username.includes(q) ||
      orderId.includes(q) ||
      paymentId.includes(q) ||
      receiptNo.includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-fade-in p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
            <CreditCard className="w-6 h-6 text-primary" />
            Online Payments & Invoicing
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time Razorpay transactions, cryptographic verifications, and financial ledger audit.
          </p>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Transactions</p>
              <p className="text-2xl font-extrabold text-foreground mt-1">{totalPayments}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Receipt className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Captured Volume</p>
              <p className="text-2xl font-extrabold text-emerald-500 mt-1">
                ₹
                {payments
                  .filter((p) => p.status === 'CAPTURED')
                  .reduce((sum, p) => sum + p.amountRupees, 0)
                  .toLocaleString('en-IN')}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Refunded Total</p>
              <p className="text-2xl font-extrabold text-amber-500 mt-1">
                ₹
                {payments
                  .reduce((sum, p) => sum + (p.refundedAmountRupees || 0), 0)
                  .toLocaleString('en-IN')}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <RotateCcw className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Search by student, order ID, payment ID, or receipt..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-xl bg-background"
            />
          </div>

          <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
            <SelectTrigger className="w-[180px] h-10 rounded-xl bg-background">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="CAPTURED">Captured</SelectItem>
              <SelectItem value="CREATED">Created (In-flight)</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="REFUNDED">Refunded</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card className="bg-card border-border shadow-sm overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/40 border-border">
                <TableHead className="font-bold text-foreground">Date</TableHead>
                <TableHead className="font-bold text-foreground">Student</TableHead>
                <TableHead className="font-bold text-foreground">Month</TableHead>
                <TableHead className="font-bold text-foreground">Amount</TableHead>
                <TableHead className="font-bold text-foreground">Status</TableHead>
                <TableHead className="font-bold text-foreground">Invoice / Receipt</TableHead>
                <TableHead className="font-bold text-foreground">Payment ID</TableHead>
                <TableHead className="font-bold text-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading payment records...
                  </TableCell>
                </TableRow>
              ) : filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    No payments found matching criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((p) => {
                  let statusBadge = (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      Captured
                    </Badge>
                  );
                  if (p.status === 'CREATED') {
                    statusBadge = (
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                        Created
                      </Badge>
                    );
                  } else if (p.status === 'FAILED') {
                    statusBadge = (
                      <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30">
                        Failed
                      </Badge>
                    );
                  } else if (p.status === 'REFUNDED') {
                    statusBadge = (
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                        Refunded
                      </Badge>
                    );
                  }

                  const canRefund =
                    p.status === 'CAPTURED' &&
                    (!p.refundedAmountRupees || p.refundedAmountRupees < p.amountRupees);

                  return (
                    <TableRow key={p._id} className="border-border/60 hover:bg-secondary/30 transition-colors">
                      <TableCell className="text-foreground text-xs whitespace-nowrap">
                        {p.createdAt ? format(parseISO(p.createdAt), 'dd MMM yyyy, HH:mm') : 'N/A'}
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">
                        <div>
                          <p>{p.studentId?.name || 'Unknown Student'}</p>
                          <p className="text-xs text-muted-foreground font-mono">@{p.studentId?.username || 'N/A'}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-foreground font-medium text-xs">
                        {p.feeId?.month || 'N/A'}
                      </TableCell>
                      <TableCell className="text-foreground font-bold font-mono">
                        ₹{p.amountRupees.toLocaleString('en-IN')}
                        {p.refundedAmountRupees ? (
                          <span className="block text-xs font-normal text-amber-500">
                            (Ref: -₹{p.refundedAmountRupees.toLocaleString('en-IN')})
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>{statusBadge}</TableCell>
                      <TableCell className="text-foreground font-mono text-xs">
                        {p.receiptNo || 'Pending'}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {p.paymentId || p.orderId}
                      </TableCell>
                      <TableCell className="text-right">
                        {canRefund && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenRefund(p)}
                            className="h-8 text-xs rounded-lg border-border hover:bg-amber-500/10 hover:text-amber-500"
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                            Refund
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border flex justify-end">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className={page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                <span className="text-xs text-muted-foreground px-4 self-center">
                  Page {page} of {totalPages}
                </span>
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className={page === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </Card>

      {/* Refund Modal */}
      {selectedPaymentForRefund && (
        <Dialog open={Boolean(selectedPaymentForRefund)} onOpenChange={() => setSelectedPaymentForRefund(null)}>
          <DialogContent className="sm:max-w-[420px] bg-card border-border rounded-2xl p-6 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-amber-500" />
                Issue Refund
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Issue a full or partial refund. A reversing financial ledger entry will be recorded automatically.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-2 text-sm">
              <div className="bg-secondary/40 border border-border/80 rounded-xl p-3.5 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Original Payment</span>
                  <span className="font-bold text-foreground">
                    ₹{selectedPaymentForRefund.amountRupees.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Provider Payment ID</span>
                  <span className="font-mono text-xs text-foreground">
                    {selectedPaymentForRefund.paymentId}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  Refund Amount (₹)
                </label>
                <Input
                  type="number"
                  min="1"
                  max={selectedPaymentForRefund.amountRupees - (selectedPaymentForRefund.refundedAmountRupees || 0)}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="rounded-xl h-10"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  Reason for Refund
                </label>
                <Input
                  placeholder="e.g. Student vacated room early / fee waiver adjustment"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="rounded-xl h-10"
                />
              </div>
            </div>

            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setSelectedPaymentForRefund(null)} className="rounded-xl border-border">
                Cancel
              </Button>
              <Button
                onClick={handleExecuteRefund}
                disabled={refunding || !refundAmount || parseFloat(refundAmount) <= 0}
                className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold"
              >
                {refunding ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
                Confirm Refund
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
