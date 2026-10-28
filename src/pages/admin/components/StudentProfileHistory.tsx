import React, { useState } from 'react';
import { getAvatarUrl } from '@/utils/imageUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Download,
  Plus,
  Building2,
  Users,
  ShieldCheck,
  Calendar,
  Phone,
  Clock,
  CheckCircle2,
  AlertCircle,
  IndianRupee,
  Layers,
  ArrowRight,
  Receipt,
  User,
  Eye,
  Printer,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { extractFloor } from './StudentFeeMatrix';
import { cn } from '@/lib/utils';
import { formatDateDMY } from '@/utils/dateUtils';
import {
  FeeReceiptData,
  SecurityDepositReceiptData,
  downloadFeeReceipt,
  downloadSecurityDepositReceipt,
  printFeeReceipt,
} from '@/lib/receiptPdf';
import { HostelFeeReceiptModal } from '@/components/receipts/HostelFeeReceiptModal';

interface StudentProfileHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedStudent: any;
  allStudents?: any[];
  selectedStudentDeposit: any;
  selectedStudentFees: any[];
  selectedStudentPayments: any[];
  downloadHistoryForStudent: (student: any) => void;
  openCollect: (student: any) => void;
  onSelectAnotherStudent?: (student: any) => void;
}

export function StudentProfileHistory({
  open,
  onOpenChange,
  selectedStudent,
  allStudents = [],
  selectedStudentDeposit,
  selectedStudentFees,
  selectedStudentPayments,
  downloadHistoryForStudent,
  openCollect,
  onSelectAnotherStudent,
}: StudentProfileHistoryProps) {
  const [previewReceiptNo, setPreviewReceiptNo] = useState<string | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  if (!selectedStudent) return null;

  const handleDownloadFeeReceipt = async (p: any) => {
    try {
      const data: FeeReceiptData = {
        receipt_no: p.receipt_no,
        payment_date: p.payment_date,
        student_name: selectedStudent.name,
        username: selectedStudent.username,
        student_code: selectedStudent.student_code || selectedStudent.studentCode,
        room_no: selectedStudent.room_no,
        hostel: p.hostel || selectedStudent.hostel || 'Hostel Campus',
        month: p.month,
        monthly_fee: p.amount,
        late_fee: p.late_fee || 0,
        discount: p.discount || 0,
        amount_paid: p.amount,
        payment_mode: p.payment_mode,
        admin_name: p.admin_name,
        notes: p.notes,
        deposit_collected_separately: p.security_deposit > 0 ? p.security_deposit : null,
        deposit_receipt_no: p.deposit_receipt_no || null,
      };
      await downloadFeeReceipt(data);
    } catch {
      downloadHistoryForStudent(selectedStudent);
    }
  };

  const handlePrintFeeReceipt = async (p: any) => {
    try {
      const data: FeeReceiptData = {
        receipt_no: p.receipt_no,
        payment_date: p.payment_date,
        student_name: selectedStudent.name,
        username: selectedStudent.username,
        student_code: selectedStudent.student_code || selectedStudent.studentCode,
        room_no: selectedStudent.room_no,
        hostel: p.hostel || selectedStudent.hostel || 'Hostel Campus',
        month: p.month,
        monthly_fee: p.amount,
        late_fee: p.late_fee || 0,
        discount: p.discount || 0,
        amount_paid: p.amount,
        payment_mode: p.payment_mode,
        admin_name: p.admin_name,
        notes: p.notes,
        deposit_collected_separately: p.security_deposit > 0 ? p.security_deposit : null,
        deposit_receipt_no: p.deposit_receipt_no || null,
      };
      await printFeeReceipt(data);
    } catch {
      // Fallback
    }
  };

  const handleDownloadDepositReceipt = async (p: any) => {
    try {
      const data: SecurityDepositReceiptData = {
        receipt_no: p.deposit_receipt_no || `DEP-${p.receipt_no}`,
        payment_date: p.payment_date,
        student_name: selectedStudent.name,
        username: selectedStudent.username,
        student_code: selectedStudent.student_code || selectedStudent.studentCode,
        room_no: selectedStudent.room_no,
        hostel: selectedStudent.hostel || 'Q2',
        deposit_amount: p.security_deposit,
        payment_mode: p.payment_mode,
        admin_name: p.admin_name,
        notes: p.notes,
      };
      await downloadSecurityDepositReceipt(data);
    } catch {
      downloadHistoryForStudent(selectedStudent);
    }
  };

  const handleDownloadStandaloneDepositReceipt = async () => {
    if (!selectedStudentDeposit) return;
    try {
      const data: SecurityDepositReceiptData = {
        receipt_no: selectedStudentDeposit.receipt_no || `DEP-${selectedStudent.username}`,
        payment_date: selectedStudentDeposit.collected_date || new Date().toISOString(),
        student_name: selectedStudent.name,
        username: selectedStudent.username,
        student_code: selectedStudent.student_code || selectedStudent.studentCode,
        room_no: selectedStudent.room_no,
        hostel: selectedStudent.hostel || 'Q2',
        deposit_amount: selectedStudentDeposit.amount,
        payment_mode: selectedStudentDeposit.payment_mode || 'offline',
        admin_name: selectedStudentDeposit.notes,
        notes: selectedStudentDeposit.notes,
      };
      await downloadSecurityDepositReceipt(data);
    } catch {
      downloadHistoryForStudent(selectedStudent);
    }
  };

  // Floor calculation
  const floorName = extractFloor(selectedStudent.room_no, selectedStudent.floor);

  // Roommates calculation (other students in the same room)
  const roommates = React.useMemo(() => {
    if (!selectedStudent.room_no) return [];
    return allStudents.filter(
      (s) => s.id !== selectedStudent.id && s.room_no && s.room_no.trim() === selectedStudent.room_no.trim()
    );
  }, [allStudents, selectedStudent]);

  // Room Type description based on occupancy
  const totalOccupants = 1 + roommates.length;
  let roomType = 'Single Sharing';
  if (totalOccupants === 2) roomType = 'Double Sharing';
  else if (totalOccupants === 3) roomType = 'Triple Sharing';
  else if (totalOccupants >= 4) roomType = `${totalOccupants}-Bed Sharing`;

  // Financial totals (Memoized)
  const totalPaidOverall = React.useMemo(() => {
    return selectedStudentPayments.reduce(
      (sum, p) => sum + Number(p.amount || 0) + Number(p.security_deposit || 0),
      0
    );
  }, [selectedStudentPayments]);

  const totalPendingBalance = React.useMemo(() => {
    return selectedStudentFees
      .filter((f) => f.status !== 'paid')
      .reduce((sum, f) => sum + Math.max(0, f.amount + (f.late_fee || 0) - (f.discount || 0) - (f.paid_amount || 0)), 0);
  }, [selectedStudentFees]);

  // Latest payment info
  const latestPayment = React.useMemo(() => {
    return selectedStudentPayments.length > 0 ? selectedStudentPayments[0] : null;
  }, [selectedStudentPayments]);

  // Status computation for the current month
  const currentMonthName = format(new Date(), 'MMMM yyyy');
  const currentFeeRecord = React.useMemo(() => {
    return selectedStudentFees.find((f) => f.month === currentMonthName);
  }, [selectedStudentFees, currentMonthName]);

  const isExpired = selectedStudent.valid_date ? new Date(selectedStudent.valid_date) < new Date() : false;

  const feeStatusBadge = React.useMemo(() => {
    if (isExpired || (currentFeeRecord && currentFeeRecord.status === 'unpaid') || (!currentFeeRecord && totalPendingBalance > 0)) {
      return (
        <Badge variant="destructive" className="text-xs px-3 py-1">
          <AlertCircle className="w-3.5 h-3.5 mr-1" /> PENDING
        </Badge>
      );
    } else if (currentFeeRecord?.status === 'partial') {
      return (
        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs px-3 py-1">
          <Clock className="w-3.5 h-3.5 mr-1" /> PARTIAL
        </Badge>
      );
    }
    return (
      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs px-3 py-1">
        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> PAID
      </Badge>
    );
  }, [isExpired, currentFeeRecord, totalPendingBalance]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 shadow-2xl">
        <DialogHeader className="border-b border-border/50 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              {/* Student Avatar */}
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary/10 border-2 border-primary/30 flex items-center justify-center text-primary shrink-0 overflow-hidden shadow-md">
                {selectedStudent.profile_photo ? (
                  <img
                    src={getAvatarUrl(selectedStudent.profile_photo, 128)}
                    alt={selectedStudent.name}
                    width={64}
                    height={64}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-bold">
                    {selectedStudent.name
                      .split(' ')
                      .map((n: string) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-xl sm:text-2xl font-bold text-foreground">
                    {selectedStudent.name}
                  </DialogTitle>
                  {feeStatusBadge}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-3 mt-1 flex-wrap">
                  <span>@{selectedStudent.username}</span>
                  {selectedStudent.start_date && (
                    <span className="flex items-center gap-1 font-mono text-foreground font-medium">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      Joined: {formatDateDMY(selectedStudent.start_date)}
                    </span>
                  )}
                  {selectedStudent.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-muted-foreground" />
                      {selectedStudent.phone}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadHistoryForStudent(selectedStudent)}
                className="gap-1.5 text-xs h-9 rounded-xl border-border hover:bg-secondary"
              >
                <Download className="w-4 h-4 text-muted-foreground" />
                Download Statement
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  openCollect(selectedStudent);
                }}
                className="gap-1.5 text-xs h-9 rounded-xl shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Collect Fee
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Room & Occupancy Information Card */}
          <div className="bg-secondary/40 border border-border/60 rounded-2xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                <Building2 className="w-3.5 h-3.5 text-primary" /> Room Number
              </p>
              <p className="text-sm font-bold text-foreground font-mono">
                {selectedStudent.room_no || 'Unassigned'}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                <Layers className="w-3.5 h-3.5 text-primary" /> Floor Level
              </p>
              <p className="text-sm font-bold text-foreground">{floorName}</p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                <Users className="w-3.5 h-3.5 text-primary" /> Room Type
              </p>
              <p className="text-sm font-bold text-foreground">{roomType}</p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                <Users className="w-3.5 h-3.5 text-primary" /> Roommates ({roommates.length})
              </p>
              {roommates.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {roommates.map((rm) => (
                    <button
                      key={rm.id}
                      onClick={() => onSelectAnotherStudent?.(rm)}
                      className="text-xs font-semibold text-primary hover:underline bg-primary/10 px-2 py-0.5 rounded-md transition-colors"
                      title="Click to view roommate profile"
                    >
                      {rm.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">None (Single room)</p>
              )}
            </div>
          </div>

          {/* Financial Breakdown Metric Cards */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-primary" /> Financial Overview ({currentMonthName})
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-card border border-border/80 p-3.5 rounded-2xl space-y-1 shadow-sm">
                <p className="text-xs text-muted-foreground">Monthly Fee</p>
                <p className="text-base sm:text-lg font-bold text-foreground font-mono">
                  ₹{(selectedStudent.fees || 0).toLocaleString('en-IN')}
                </p>
              </div>

              <div className="bg-card border border-border/80 p-3.5 rounded-2xl space-y-1 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Security Deposit</p>
                  {selectedStudentDeposit?.status === 'collected' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 hover:bg-blue-500/20 text-blue-400 rounded-lg"
                      onClick={handleDownloadStandaloneDepositReceipt}
                      title="Download Security Deposit Receipt PDF"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                <p className="text-base sm:text-lg font-bold text-foreground font-mono">
                  ₹{(selectedStudentDeposit?.amount || 0).toLocaleString('en-IN')}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-[10px] text-muted-foreground capitalize">
                    Status: {selectedStudentDeposit?.status || 'Active'}
                  </p>
                  {selectedStudentDeposit?.receipt_no && (
                    <span className="text-[9px] font-mono text-blue-400">
                      #{selectedStudentDeposit.receipt_no}
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-card border border-border/80 p-3.5 rounded-2xl space-y-1 shadow-sm">
                <p className="text-xs text-muted-foreground">Total Paid</p>
                <p className="text-base sm:text-lg font-bold text-emerald-400 font-mono">
                  ₹{totalPaidOverall.toLocaleString('en-IN')}
                </p>
                {latestPayment && (
                  <p className="text-[10px] text-muted-foreground truncate">
                    Last: {format(parseISO(latestPayment.payment_date), 'dd MMM yyyy')}
                  </p>
                )}
              </div>

              <div className="bg-card border border-border/80 p-3.5 rounded-2xl space-y-1 shadow-sm">
                <p className="text-xs text-muted-foreground">Pending Balance</p>
                <p
                  className={cn(
                    'text-base sm:text-lg font-bold font-mono',
                    totalPendingBalance > 0 ? 'text-rose-400' : 'text-muted-foreground'
                  )}
                >
                  ₹{totalPendingBalance.toLocaleString('en-IN')}
                </p>
                <p className="text-[10px] text-muted-foreground font-mono">
                  Valid till: {formatDateDMY(selectedStudent.valid_date)}
                </p>
              </div>
            </div>
          </div>

          {/* Monthly Fee Records Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" /> Monthly Fee Breakdown
              </h4>
            </div>

            <div className="border border-border/70 rounded-2xl overflow-hidden bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/40 hover:bg-secondary/40 border-border/60">
                    <TableHead className="text-foreground font-semibold text-xs">Month</TableHead>
                    <TableHead className="text-foreground font-semibold text-xs">Base Amount</TableHead>
                    <TableHead className="text-foreground font-semibold text-xs">Late Fee</TableHead>
                    <TableHead className="text-foreground font-semibold text-xs">Discount</TableHead>
                    <TableHead className="text-foreground font-semibold text-xs">Paid</TableHead>
                    <TableHead className="text-foreground font-semibold text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedStudentFees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-6 text-xs">
                        No monthly fee records available
                      </TableCell>
                    </TableRow>
                  ) : (
                    selectedStudentFees.map((f) => (
                      <TableRow key={f.id} className="border-border/40 hover:bg-secondary/30">
                        <TableCell className="font-medium text-foreground text-xs">{f.month}</TableCell>
                        <TableCell className="text-foreground font-mono text-xs">₹{f.amount}</TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">₹{f.late_fee || 0}</TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">₹{f.discount || 0}</TableCell>
                        <TableCell className="text-emerald-400 font-mono font-medium text-xs">
                          ₹{f.paid_amount || 0}
                        </TableCell>
                        <TableCell>
                          {f.status === 'paid' ? (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                              Paid
                            </Badge>
                          ) : f.status === 'partial' ? (
                            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
                              Partial
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px]">
                              Unpaid
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Payment History Timeline Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" /> Payment History & Transaction Receipts
            </h4>

            <div className="border border-border/70 rounded-2xl overflow-hidden bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/40 hover:bg-secondary/40 border-border/60">
                    <TableHead className="text-foreground font-semibold text-xs">Date</TableHead>
                    <TableHead className="text-foreground font-semibold text-xs">Receipt #</TableHead>
                    <TableHead className="text-foreground font-semibold text-xs">Month</TableHead>
                    <TableHead className="text-foreground font-semibold text-xs">Amount</TableHead>
                    <TableHead className="text-foreground font-semibold text-xs">Mode</TableHead>
                    <TableHead className="text-foreground font-semibold text-xs text-right">Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedStudentPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-6 text-xs">
                        No recorded payment transactions yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    selectedStudentPayments.map((p) => (
                      <TableRow key={p.id} className="border-border/40 hover:bg-secondary/30">
                        <TableCell className="text-foreground text-xs">
                          {format(parseISO(p.payment_date), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell className="text-foreground font-mono text-xs font-semibold">
                          <div>{p.receipt_no}</div>
                          {p.deposit_receipt_no && (
                            <div className="text-[10px] text-blue-400 font-normal">
                              Dep: #{p.deposit_receipt_no}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-foreground text-xs">{p.month}</TableCell>
                        <TableCell className="text-emerald-400 font-mono font-medium text-xs">
                          <div>₹{Number(p.amount).toLocaleString('en-IN')}</div>
                          {p.security_deposit > 0 && (
                            <div className="text-[10px] text-blue-400 font-normal">
                              +₹{Number(p.security_deposit).toLocaleString('en-IN')} dep
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-foreground uppercase text-[11px] font-mono">
                          {p.payment_mode}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 hover:bg-purple-500/20 text-purple-600 rounded-lg"
                              onClick={() => {
                                setPreviewReceiptNo(p.receipt_no);
                                setShowReceiptModal(true);
                              }}
                              title={`Preview Official Receipt #${p.receipt_no}`}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 hover:bg-primary/20 hover:text-primary rounded-lg"
                              onClick={() => handleDownloadFeeReceipt(p)}
                              title={`Download Hostel Fee Receipt #${p.receipt_no}`}
                            >
                              <Download className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 hover:bg-slate-200 text-slate-600 rounded-lg"
                              onClick={() => handlePrintFeeReceipt(p)}
                              title={`Print Receipt #${p.receipt_no}`}
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </Button>
                            {(p.deposit_receipt_no || p.security_deposit > 0) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 hover:bg-blue-500/20 text-blue-400 rounded-lg"
                                onClick={() => handleDownloadDepositReceipt(p)}
                                title={`Download Security Deposit Receipt #${p.deposit_receipt_no || p.receipt_no}`}
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </DialogContent>

      <HostelFeeReceiptModal
        open={showReceiptModal}
        onOpenChange={setShowReceiptModal}
        receiptNo={previewReceiptNo}
      />
    </Dialog>
  );
}
