/**
 * CollectPaymentDialog — self-contained payment form.
 * All payment form state lives HERE (not in the 924-line parent).
 * Keystroke events in this dialog no longer trigger FeeManagement re-renders.
 */
import { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Check, Receipt } from 'lucide-react';

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
  open, onOpenChange, selectedStudent,
  initialValues, monthOptions, onSubmit,
}: CollectPaymentDialogProps) {
  // All form state is local to this dialog — parent never re-renders on field change
  const [form, setForm] = useState<PaymentFormState>(initialValues);
  const [submitting, setSubmitting] = useState(false);

  // Reset form state whenever dialog opens with new initialValues
  useEffect(() => {
    if (open) setForm(initialValues);
  }, [open, initialValues]);

  const set = useCallback(<K extends keyof PaymentFormState>(key: K, value: PaymentFormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSubmit = async () => {
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
          <DialogTitle className="text-foreground flex items-center gap-2"><Receipt className="w-5 h-5" />Collect Payment</DialogTitle>
          <DialogDescription>Record payment and auto-generate PDF receipt</DialogDescription>
        </DialogHeader>
        {selectedStudent && (
          <div className="space-y-3">
            <div className="p-3 bg-secondary rounded-lg">
              <p className="font-semibold text-foreground">{selectedStudent.name}</p>
              <p className="text-xs text-muted-foreground">{selectedStudent.username} • Room {selectedStudent.room_no || 'N/A'}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fee Month</Label>
                <Select value={form.pMonth} onValueChange={(v) => set('pMonth', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Monthly Fee (₹)</Label>
                <Input type="number" value={form.pAmount} onChange={(e) => set('pAmount', Number(e.target.value))} />
              </div>
              <div>
                <Label>Late Fee (₹)</Label>
                <Input type="number" value={form.pLateFee} onChange={(e) => set('pLateFee', Number(e.target.value))} />
              </div>
              <div>
                <Label>Discount (₹)</Label>
                <Input type="number" value={form.pDiscount} onChange={(e) => set('pDiscount', Number(e.target.value))} />
              </div>
              <div>
                <Label>Security Deposit (₹)</Label>
                <Input type="number" value={form.pDeposit} onChange={(e) => set('pDeposit', Number(e.target.value))} />
              </div>
              <div>
                <Label>Amount Received (₹)</Label>
                <Input type="number" value={form.pReceived} onChange={(e) => set('pReceived', Number(e.target.value))} />
              </div>
            </div>
            <div>
              <Label>Payment Mode</Label>
              <Select value={form.pMode} onValueChange={(v: 'cash' | 'upi' | 'bank') => set('pMode', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea value={form.pNotes} onChange={(e) => set('pNotes', e.target.value)} rows={2} />
            </div>
            <div className="p-3 bg-secondary rounded-lg text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Total Due:</span><span className="text-foreground font-medium">₹{(form.pAmount + form.pLateFee - form.pDiscount).toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">+ Deposit:</span><span className="text-foreground font-medium">₹{form.pDeposit.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between text-primary font-bold mt-1"><span>Receiving:</span><span>₹{form.pReceived.toLocaleString('en-IN')}</span></div>
            </div>
            <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Recording...' : <><Check className="w-4 h-4 mr-2" />Confirm & Download Receipt</>}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
