/**
 * CollectPaymentDialog — Dynamic Late-Fee Calculation & Payment Collection
 *
 * Implements:
 * - Dynamic late-fee retrieval via backend calculation service
 * - Automatic re-calculation upon month change
 * - Grace period and hostel policy breakdown display
 * - Security deposit collection separation
 * - Duplicate submission prevention
 */
import { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Receipt, AlertCircle, Clock, Info, ShieldCheck } from 'lucide-react';
import { feeService } from '@/services/api/fee.service';

interface PaymentFormState {
  pMonth: string;
  pAmount: number;
  pLateFee: number;
  pDiscount: number;
  pDeposit: number;
  pReceived: number;
  pMode: 'cash' | 'upi' | 'bank';
  pNotes: string;
}

interface CalculationDetails {
  baseFee: number;
  paidAmount: number;
  outstandingAmount: number;
  applicableLateFee: number;
  overdueDays: number;
  isOverdue: boolean;
  dueDate: string | null;
  depositDue: number;
  totalPayable: number;
  status: string;
}

interface CollectPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedStudent: any;
  initialValues: PaymentFormState;
  monthOptions: string[];
  onSubmit: (form: PaymentFormState) => Promise<void>;
}

export type { PaymentFormState };

export function CollectPaymentDialog({
  open,
  onOpenChange,
  selectedStudent,
  initialValues,
  monthOptions,
  onSubmit,
}: CollectPaymentDialogProps) {
  const [form, setForm] = useState<PaymentFormState>(initialValues);
  const [submitting, setSubmitting] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [calcDetails, setCalcDetails] = useState<CalculationDetails | null>(null);

  // Synchronize initial values only when dialog opens or selectedStudent changes
  useEffect(() => {
    if (open) {
      setForm(initialValues);
      setCalcDetails(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedStudent?.id]);

  // Dynamic late-fee & payable fee calculation when month changes
  const fetchCalculation = useCallback(
    async (studentId: string, month: string) => {
      if (!studentId || !month) return;
      setCalculating(true);
      try {
        const res = await feeService.calculatePayableFee({
          studentId,
          feeMonth: month,
        });

        if (res.success && res.data) {
          const c = res.data;
          setCalcDetails(c);
          setForm((prev) => {
            const isSettled = c.status === 'paid';
            const newAmount = isSettled ? 0 : (c.outstandingAmount > 0 ? c.outstandingAmount : c.baseFee);
            const newLateFee = isSettled ? 0 : (c.applicableLateFee || 0);
            const newDeposit = c.depositDue || 0;
            const newTotal = isSettled
              ? newDeposit
              : Math.max(0, newAmount + newLateFee + newDeposit - (prev.pDiscount || 0));
            return {
              ...prev,
              pMonth: month,
              pAmount: newAmount,
              pLateFee: newLateFee,
              pDeposit: newDeposit,
              pReceived: newTotal,
            };
          });
        }
      } catch (err) {
        console.warn('[CollectPaymentDialog] Fee calculation error:', err);
      } finally {
        setCalculating(false);
      }
    },
    []
  );

  // Trigger calculation when dialog opens or student/month changes
  useEffect(() => {
    if (open && selectedStudent?.id && form.pMonth) {
      fetchCalculation(selectedStudent.id, form.pMonth);
    }
  }, [open, selectedStudent?.id, form.pMonth, fetchCalculation]);

  const set = useCallback(<K extends keyof PaymentFormState>(key: K, value: PaymentFormState[K]) => {
    setForm((prev) => {
      const updated = { ...prev, [key]: value };
      // Auto-recalculate received amount if base amounts changed and user hasn't typed custom received
      if (key === 'pAmount' || key === 'pLateFee' || key === 'pDiscount' || key === 'pDeposit') {
        const computedTotal = Math.max(
          0,
          Number(updated.pAmount || 0) +
            Number(updated.pLateFee || 0) +
            Number(updated.pDeposit || 0) -
            Number(updated.pDiscount || 0)
        );
        updated.pReceived = computedTotal;
      }
      return updated;
    });
  }, []);

  const totalFeeDue = Math.max(0, form.pAmount + form.pLateFee - form.pDiscount);
  const totalAllPayable = totalFeeDue + form.pDeposit;

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            Collect Payment
          </DialogTitle>
          <DialogDescription>
            Dynamic calculation applies hostel fee policies, grace periods & security deposits.
          </DialogDescription>
        </DialogHeader>

        {selectedStudent && (
          <div className="space-y-4">
            {/* Student Header Summary */}
            <div className="p-3 bg-secondary/80 border border-border/80 rounded-xl flex items-center justify-between">
              <div>
                <p className="font-bold text-foreground text-sm">{selectedStudent.name}</p>
                <p className="text-xs text-muted-foreground">
                  User ID: <span className="font-mono text-foreground font-medium">@{selectedStudent.username}</span> • Room:{' '}
                  <span className="font-mono text-foreground font-medium">{selectedStudent.room_no || 'N/A'}</span>
                </p>
              </div>
              <Badge variant="outline" className="text-xs bg-background">
                {selectedStudent.hostel || 'Q2'}
              </Badge>
            </div>

            {/* Dynamic Calculation Status Alert */}
            {calculating ? (
              <div className="p-2.5 bg-secondary/50 border border-border rounded-xl text-xs text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 animate-spin text-primary" />
                Calculating applicable fee rules & grace period...
              </div>
            ) : calcDetails ? (
              calcDetails.status === 'paid' ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Notice: Fee already marked as PAID for {form.pMonth}.</span>
                    <p className="text-amber-400/80 mt-0.5">
                      Previously collected: ₹{calcDetails.paidAmount.toLocaleString('en-IN')}. Submitting another payment will record an authorized extra adjustment.
                    </p>
                  </div>
                </div>
              ) : calcDetails.isOverdue ? (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                  <Clock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Overdue Fee Policy Applied</span>
                    <p className="text-rose-400/90 mt-0.5">
                      Fee was due on {calcDetails.dueDate ? new Date(calcDetails.dueDate).toLocaleDateString('en-IN') : 'due date'} ({calcDetails.overdueDays} days overdue). Late fee of ₹{calcDetails.applicableLateFee} automatically added per hostel rule.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>On schedule: Within grace period. Late fee: ₹0.</span>
                </div>
              )
            ) : null}

            {/* Form Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Fee Month</Label>
                <Select value={form.pMonth} onValueChange={(v) => set('pMonth', v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Monthly Rent Due (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  className="h-9"
                  value={form.pAmount}
                  onChange={(e) => set('pAmount', Math.max(0, Number(e.target.value)))}
                />
              </div>

              <div>
                <Label className="text-xs flex items-center justify-between">
                  <span>Late Fee (₹)</span>
                  {calcDetails?.applicableLateFee ? (
                    <span className="text-[10px] text-amber-400 font-normal">Hostel Rule</span>
                  ) : null}
                </Label>
                <Input
                  type="number"
                  min="0"
                  className="h-9"
                  value={form.pLateFee}
                  onChange={(e) => set('pLateFee', Math.max(0, Number(e.target.value)))}
                />
              </div>

              <div>
                <Label className="text-xs">Discount / Waiver (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  className="h-9"
                  value={form.pDiscount}
                  onChange={(e) => set('pDiscount', Math.max(0, Number(e.target.value)))}
                />
              </div>

              <div>
                <Label className="text-xs flex items-center justify-between">
                  <span>Security Deposit (₹)</span>
                  {calcDetails?.depositDue ? (
                    <span className="text-[10px] text-blue-400 font-normal">Pending Deposit</span>
                  ) : null}
                </Label>
                <Input
                  type="number"
                  min="0"
                  className="h-9"
                  value={form.pDeposit}
                  onChange={(e) => set('pDeposit', Math.max(0, Number(e.target.value)))}
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-primary">Amount Received (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  className="h-9 font-bold text-foreground border-primary/50"
                  value={form.pReceived}
                  onChange={(e) => set('pReceived', Math.max(0, Number(e.target.value)))}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Payment Mode</Label>
              <Select value={form.pMode} onValueChange={(v: 'cash' | 'upi' | 'bank') => set('pMode', v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upi">UPI / Dynamic QR</SelectItem>
                  <SelectItem value="cash">Cash at Front Desk</SelectItem>
                  <SelectItem value="bank">Direct Bank Transfer / NEFT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Notes (optional)</Label>
              <Textarea
                value={form.pNotes}
                onChange={(e) => set('pNotes', e.target.value)}
                placeholder="e.g. UTR / Transaction ID or remark"
                rows={2}
                className="text-xs"
              />
            </div>

            {/* Breakdown Summary Card */}
            <div className="p-3 bg-secondary/70 border border-border/80 rounded-xl text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly Rent:</span>
                <span className="font-mono text-foreground">₹{form.pAmount.toLocaleString('en-IN')}</span>
              </div>
              {form.pLateFee > 0 && (
                <div className="flex justify-between text-amber-400">
                  <span>+ Late Fee:</span>
                  <span className="font-mono">+₹{form.pLateFee.toLocaleString('en-IN')}</span>
                </div>
              )}
              {form.pDiscount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>- Discount:</span>
                  <span className="font-mono">-₹{form.pDiscount.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between font-medium pt-1 border-t border-border/50">
                <span className="text-foreground">Monthly Fee Due:</span>
                <span className="font-mono text-foreground font-bold">₹{totalFeeDue.toLocaleString('en-IN')}</span>
              </div>
              {form.pDeposit > 0 && (
                <div className="flex justify-between text-blue-400">
                  <span>+ Security Deposit (Separate):</span>
                  <span className="font-mono">₹{form.pDeposit.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between text-primary font-extrabold text-sm pt-1.5 border-t border-border">
                <span>Total Amount Receiving:</span>
                <span className="font-mono text-base">₹{form.pReceived.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <Button
              className="w-full h-10 font-bold"
              onClick={handleSubmit}
              disabled={submitting || calculating || (calcDetails?.status === 'paid' && form.pAmount === 0 && form.pDeposit === 0)}
            >
              {submitting ? (
                'Processing & Generating Receipt...'
              ) : calcDetails?.status === 'paid' && form.pAmount === 0 && form.pDeposit === 0 ? (
                'Fee Already Settled for this Month'
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Confirm Collection & Download PDF Receipt
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
