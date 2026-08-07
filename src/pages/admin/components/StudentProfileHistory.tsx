import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Download, Plus } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface StudentProfileHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedStudent: any;
  selectedStudentDeposit: any;
  selectedStudentFees: any[];
  selectedStudentPayments: any[];
  downloadHistoryForStudent: (student: any) => void;
  openCollect: (student: any) => void;
}

export function StudentProfileHistory({
  open,
  onOpenChange,
  selectedStudent,
  selectedStudentDeposit,
  selectedStudentFees,
  selectedStudentPayments,
  downloadHistoryForStudent,
  openCollect
}: StudentProfileHistoryProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2"><FileText className="w-5 h-5" />Student Fee Profile</DialogTitle>
        </DialogHeader>
        {selectedStudent && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-secondary rounded-lg">
              <div><p className="text-xs text-muted-foreground">Name</p><p className="font-medium text-foreground">{selectedStudent.name}</p></div>
              <div><p className="text-xs text-muted-foreground">User ID</p><p className="font-medium text-foreground">{selectedStudent.username}</p></div>
              <div><p className="text-xs text-muted-foreground">Room</p><p className="font-medium text-foreground">{selectedStudent.room_no || 'N/A'}</p></div>
              <div><p className="text-xs text-muted-foreground">Monthly Fee</p><p className="font-medium text-foreground">₹{(selectedStudent.fees || 0).toLocaleString('en-IN')}</p></div>
              <div><p className="text-xs text-muted-foreground">Start Date</p><p className="font-medium text-foreground">{selectedStudent.start_date ? format(parseISO(selectedStudent.start_date), 'dd MMM yyyy') : 'N/A'}</p></div>
              <div><p className="text-xs text-muted-foreground">Valid Till</p><p className="font-medium text-foreground">{selectedStudent.valid_date ? format(parseISO(selectedStudent.valid_date), 'dd MMM yyyy') : 'N/A'}</p></div>
              <div><p className="text-xs text-muted-foreground">Parent Mobile</p><p className="font-medium text-foreground">{selectedStudent.parent_phone || 'N/A'}</p></div>
              <div><p className="text-xs text-muted-foreground">Deposit</p><p className="font-medium text-foreground">₹{(selectedStudentDeposit?.amount || 0).toLocaleString('en-IN')} <span className="text-xs text-muted-foreground">({selectedStudentDeposit?.status || 'none'})</span></p></div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-foreground mb-2">Monthly Fee Records</h4>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Month</TableHead><TableHead>Amount</TableHead><TableHead>Late</TableHead><TableHead>Discount</TableHead><TableHead>Paid</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {selectedStudentFees.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">No records</TableCell></TableRow> :
                      selectedStudentFees.map(f => (
                        <TableRow key={f.id}>
                          <TableCell className="text-foreground">{f.month}</TableCell>
                          <TableCell className="text-foreground">₹{f.amount}</TableCell>
                          <TableCell className="text-foreground">₹{f.late_fee || 0}</TableCell>
                          <TableCell className="text-foreground">₹{f.discount || 0}</TableCell>
                          <TableCell className="text-foreground">₹{f.paid_amount || 0}</TableCell>
                          <TableCell>
                            {f.status === 'paid' ? <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Paid</Badge>
                              : f.status === 'partial' ? <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">Partial</Badge>
                              : <Badge variant="destructive">Unpaid</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-foreground mb-2">Payment History</h4>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Receipt</TableHead><TableHead>Month</TableHead><TableHead>Amount</TableHead><TableHead>Mode</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {selectedStudentPayments.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">No payments</TableCell></TableRow> :
                      selectedStudentPayments.map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="text-foreground">{format(parseISO(p.payment_date), 'dd MMM yyyy')}</TableCell>
                          <TableCell className="text-foreground font-mono text-xs">{p.receipt_no}</TableCell>
                          <TableCell className="text-foreground">{p.month}</TableCell>
                          <TableCell className="text-foreground">₹{Number(p.amount) + Number(p.security_deposit)}</TableCell>
                          <TableCell className="text-foreground uppercase text-xs">{p.payment_mode}</TableCell>
                          <TableCell><Button size="sm" variant="ghost" onClick={() => downloadHistoryForStudent(selectedStudent)}><Download className="w-4 h-4" /></Button></TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => { onOpenChange(false); openCollect(selectedStudent); }}>
                <Plus className="w-4 h-4 mr-2" />Collect Payment
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
