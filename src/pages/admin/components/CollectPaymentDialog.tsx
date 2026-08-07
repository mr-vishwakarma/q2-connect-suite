import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Check, Receipt } from 'lucide-react';

interface CollectPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedStudent: any;
  pMonth: string;
  setPMonth: (v: string) => void;
  monthOptions: string[];
  pAmount: number;
  setPAmount: (v: number) => void;
  pLateFee: number;
  setPLateFee: (v: number) => void;
  pDiscount: number;
  setPDiscount: (v: number) => void;
  pDeposit: number;
  setPDeposit: (v: number) => void;
  pReceived: number;
  setPReceived: (v: number) => void;
  pMode: 'cash' | 'upi' | 'bank';
  setPMode: (v: 'cash' | 'upi' | 'bank') => void;
  pNotes: string;
  setPNotes: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}

export function CollectPaymentDialog({
  open, onOpenChange, selectedStudent,
  pMonth, setPMonth, monthOptions,
  pAmount, setPAmount,
  pLateFee, setPLateFee,
  pDiscount, setPDiscount,
  pDeposit, setPDeposit,
  pReceived, setPReceived,
  pMode, setPMode,
  pNotes, setPNotes,
  onSubmit, submitting
}: CollectPaymentDialogProps) {
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
                <Select value={pMonth} onValueChange={setPMonth}>
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
                <Input type="number" value={pAmount} onChange={(e) => setPAmount(Number(e.target.value))} />
              </div>
              <div>
                <Label>Late Fee (₹)</Label>
                <Input type="number" value={pLateFee} onChange={(e) => setPLateFee(Number(e.target.value))} />
              </div>
              <div>
                <Label>Discount (₹)</Label>
                <Input type="number" value={pDiscount} onChange={(e) => setPDiscount(Number(e.target.value))} />
              </div>
              <div>
                <Label>Security Deposit (₹)</Label>
                <Input type="number" value={pDeposit} onChange={(e) => setPDeposit(Number(e.target.value))} />
              </div>
              <div>
                <Label>Amount Received (₹)</Label>
                <Input type="number" value={pReceived} onChange={(e) => setPReceived(Number(e.target.value))} />
              </div>
            </div>
            <div>
              <Label>Payment Mode</Label>
              <Select value={pMode} onValueChange={(v: 'cash' | 'upi' | 'bank') => setPMode(v)}>
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
              <Textarea value={pNotes} onChange={(e) => setPNotes(e.target.value)} rows={2} />
            </div>
            <div className="p-3 bg-secondary rounded-lg text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Total Due:</span><span className="text-foreground font-medium">₹{(pAmount + pLateFee - pDiscount).toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">+ Deposit:</span><span className="text-foreground font-medium">₹{pDeposit.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between text-primary font-bold mt-1"><span>Receiving:</span><span>₹{pReceived.toLocaleString('en-IN')}</span></div>
            </div>
            <Button className="w-full" onClick={onSubmit} disabled={submitting}>
              {submitting ? 'Recording...' : <><Check className="w-4 h-4 mr-2" />Confirm & Download Receipt</>}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
