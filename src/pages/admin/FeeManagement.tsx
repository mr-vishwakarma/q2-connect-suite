import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHostel } from '@/contexts/HostelContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Search, IndianRupee, Calendar, Check, Filter, Download, TrendingUp,
  AlertCircle, Wallet, Users, FileText, Receipt, Plus, User,
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, differenceInDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { downloadReceipt, ReceiptData } from '@/lib/receiptPdf';

interface Student {
  id: string; name: string; username: string; room_no: string | null;
  fees: number | null; start_date: string | null; valid_date: string | null;
  parent_phone?: string | null;
}

interface Fee {
  id: string; student_id: string; month: string; amount: number;
  paid_date: string | null; payment_mode: 'cash' | 'upi' | 'bank';
  status: 'paid' | 'unpaid' | 'partial';
  due_date: string | null; late_fee: number; discount: number;
  paid_amount: number; receipt_no: string | null; notes: string | null;
}

interface Payment {
  id: string; fee_id: string; student_id: string; receipt_no: string;
  amount: number; late_fee: number; discount: number; security_deposit: number;
  payment_mode: 'cash' | 'upi' | 'bank'; payment_date: string;
  admin_name: string | null; month: string; notes: string | null;
}

interface Deposit {
  id: string; student_id: string; amount: number; status: string;
  collected_date: string | null; refund_date: string | null;
}

const LATE_FEE_PER_DAY = 20;

const genReceiptNo = () =>
  `RCPT-${format(new Date(), 'yyyyMMdd')}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

export default function FeeManagement() {
  const { selectedHostel } = useHostel();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [fees, setFees] = useState<Fee[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Payment form state
  const [pMonth, setPMonth] = useState(format(new Date(), 'MMMM yyyy'));
  const [pAmount, setPAmount] = useState<number>(0);
  const [pLateFee, setPLateFee] = useState<number>(0);
  const [pDiscount, setPDiscount] = useState<number>(0);
  const [pDeposit, setPDeposit] = useState<number>(0);
  const [pReceived, setPReceived] = useState<number>(0);
  const [pMode, setPMode] = useState<'cash' | 'upi' | 'bank'>('upi');
  const [pNotes, setPNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentMonth = format(new Date(), 'MMMM yyyy');

  const fetchData = useCallback(async () => {
    try {
      const [sRes, fRes, pRes, dRes] = await Promise.all([
        supabase.from('students').select('id,name,username,room_no,fees,start_date,valid_date,parent_phone').eq('hostel', selectedHostel),
        supabase.from('fees').select('*').eq('hostel', selectedHostel).order('created_at', { ascending: false }),
        supabase.from('fee_payments').select('*').eq('hostel', selectedHostel).order('payment_date', { ascending: false }),
        supabase.from('security_deposits').select('*').eq('hostel', selectedHostel),
      ]);
      setStudents(sRes.data || []);
      setFees((fRes.data || []) as Fee[]);
      setPayments((pRes.data || []) as Payment[]);
      setDeposits((dRes.data || []) as Deposit[]);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load fee data');
    } finally {
      setLoading(false);
    }
  }, [selectedHostel]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const ch = supabase.channel(`fee-erp-${selectedHostel}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fees', filter: `hostel=eq.${selectedHostel}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fee_payments', filter: `hostel=eq.${selectedHostel}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'security_deposits', filter: `hostel=eq.${selectedHostel}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students', filter: `hostel=eq.${selectedHostel}` }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedHostel, fetchData]);

  // Build the summary row per student
  const records = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return students.map(s => {
      const currentFee = fees.find(f => f.student_id === s.id && f.month === currentMonth);
      const studentFees = fees.filter(f => f.student_id === s.id);
      const isExpired = s.valid_date ? new Date(s.valid_date) < today : false;
      const pending = studentFees
        .filter(f => f.status !== 'paid')
        .reduce((sum, f) => sum + Math.max(0, f.amount + (f.late_fee || 0) - (f.discount || 0) - (f.paid_amount || 0)), 0);
      let status: 'paid' | 'unpaid' | 'partial' = 'paid';
      if (isExpired) status = 'unpaid';
      else if (currentFee) status = currentFee.status;
      else if (pending > 0) status = 'unpaid';
      return { student: s, currentFee, isExpired, pending, status };
    });
  }, [students, fees, currentMonth]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return records.filter(r => {
      const matchesSearch = !q ||
        r.student.name.toLowerCase().includes(q) ||
        r.student.username.toLowerCase().includes(q) ||
        (r.student.room_no?.toLowerCase().includes(q)) ||
        (r.student.parent_phone?.toLowerCase().includes(q));
      const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [records, searchQuery, filterStatus]);

  // Stats
  const totalFeeAmount = useMemo(() => students.reduce((s, x) => s + (x.fees || 0), 0), [students]);
  const paidCount = records.filter(r => r.status === 'paid').length;
  const unpaidCount = records.filter(r => r.status !== 'paid').length;
  const totalPending = records.reduce((s, r) => s + r.pending, 0);
  const thisMonthCollection = useMemo(() => {
    const mS = startOfMonth(new Date()), mE = endOfMonth(new Date());
    return payments
      .filter(p => {
        try { return isWithinInterval(parseISO(p.payment_date), { start: mS, end: mE }); }
        catch { return false; }
      })
      .reduce((s, p) => s + Number(p.amount || 0) + Number(p.security_deposit || 0), 0);
  }, [payments]);
  const totalDeposits = useMemo(() => deposits.reduce((s, d) => s + Number(d.amount || 0), 0), [deposits]);

  const chartData = [
    { name: 'Total Fees', amount: totalFeeAmount },
    { name: 'Pending', amount: totalPending },
    { name: 'Collected (Month)', amount: thisMonthCollection },
    { name: 'Deposits', amount: totalDeposits },
  ];

  // Open Collect Payment dialog
  const openCollect = (s: Student) => {
    setSelectedStudent(s);
    const monthly = s.fees || 0;
    setPMonth(currentMonth);
    setPAmount(monthly);
    // late fee auto-calc based on current month's due_date
    const cf = fees.find(f => f.student_id === s.id && f.month === currentMonth);
    if (cf?.due_date) {
      const overdue = differenceInDays(new Date(), new Date(cf.due_date));
      setPLateFee(overdue > 0 ? overdue * LATE_FEE_PER_DAY : 0);
    } else setPLateFee(0);
    setPDiscount(0);
    setPDeposit(0);
    setPReceived(monthly);
    setPMode('upi');
    setPNotes('');
    setShowPaymentDialog(true);
  };

  const openProfile = (s: Student) => {
    setSelectedStudent(s);
    setShowProfileDialog(true);
  };

  const handleSubmitPayment = async () => {
    if (!selectedStudent) return;
    if (pReceived <= 0) { toast.error('Enter amount received'); return; }
    setSubmitting(true);

    try {
      // Ensure a monthly fees row exists
      let feeRow = fees.find(f => f.student_id === selectedStudent.id && f.month === pMonth);
      if (!feeRow) {
        const { data, error } = await supabase.from('fees').insert({
          student_id: selectedStudent.id,
          month: pMonth,
          amount: pAmount,
          late_fee: pLateFee,
          discount: pDiscount,
          status: 'unpaid' as const,
          hostel: selectedHostel,
          payment_mode: pMode,
        }).select().single();
        if (error) throw error;
        feeRow = data as Fee;
      } else {
        // Update late_fee / discount on the fee row so the trigger's math is correct
        await supabase.from('fees').update({
          late_fee: pLateFee, discount: pDiscount, amount: pAmount,
        }).eq('id', feeRow.id);
      }

      const receipt_no = genReceiptNo();
      const feeCore = Math.max(0, pReceived - pDeposit);
      const { error: payErr } = await supabase.from('fee_payments').insert({
        fee_id: feeRow.id,
        student_id: selectedStudent.id,
        hostel: selectedHostel,
        receipt_no,
        amount: feeCore,
        late_fee: pLateFee,
        discount: pDiscount,
        security_deposit: pDeposit,
        payment_mode: pMode,
        payment_date: new Date().toISOString().split('T')[0],
        admin_name: profile?.name || 'Admin',
        month: pMonth,
        notes: pNotes || null,
      });
      if (payErr) throw payErr;

      // Security deposit tracking
      if (pDeposit > 0) {
        await supabase.from('security_deposits').insert({
          student_id: selectedStudent.id,
          hostel: selectedHostel,
          amount: pDeposit,
          collected_date: new Date().toISOString().split('T')[0],
          status: 'collected',
          payment_mode: pMode,
        });
      }

      // Extend student valid_date if fully paid (best-effort)
      const totalDue = pAmount + pLateFee - pDiscount;
      if (feeCore >= totalDue && selectedStudent.valid_date) {
        const cur = new Date(selectedStudent.valid_date);
        cur.setMonth(cur.getMonth() + 1);
        await supabase.from('students').update({ valid_date: cur.toISOString().split('T')[0] }).eq('id', selectedStudent.id);
      }

      // PDF Receipt
      const receiptData: ReceiptData = {
        receipt_no, payment_date: new Date().toISOString(),
        student_name: selectedStudent.name, username: selectedStudent.username,
        room_no: selectedStudent.room_no, hostel: selectedHostel, month: pMonth,
        monthly_fee: pAmount, late_fee: pLateFee, discount: pDiscount,
        security_deposit: pDeposit, amount_paid: pReceived, payment_mode: pMode,
        admin_name: profile?.name, notes: pNotes,
      };
      downloadReceipt(receiptData);

      toast.success('Payment recorded, receipt generated');
      setShowPaymentDialog(false);
      fetchData();
    } catch (e: unknown) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  const reissueReceipt = (p: Payment, s: Student) => {
    const data: ReceiptData = {
      receipt_no: p.receipt_no, payment_date: p.payment_date,
      student_name: s.name, username: s.username, room_no: s.room_no,
      hostel: selectedHostel, month: p.month, monthly_fee: p.amount,
      late_fee: p.late_fee, discount: p.discount,
      security_deposit: p.security_deposit,
      amount_paid: Number(p.amount) + Number(p.security_deposit),
      payment_mode: p.payment_mode, admin_name: p.admin_name, notes: p.notes,
    };
    downloadReceipt(data);
  };

  const exportCSV = () => {
    const headers = ['Name', 'User ID', 'Room', 'Monthly (₹)', 'Pending (₹)', 'Status', 'Valid Till', 'Parent Phone'];
    const rows = filteredRecords.map(r => [
      r.student.name, r.student.username, r.student.room_no || '',
      r.student.fees || 0, r.pending, r.status,
      r.student.valid_date ? format(parseISO(r.student.valid_date), 'dd MMM yyyy') : '',
      r.student.parent_phone || '',
    ]);
    const csv = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `fee-report-${selectedHostel}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success('Report exported');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const stats = [
    { label: 'Total Students', value: students.length, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Paid', value: paidCount, icon: Check, color: 'text-green-500', bg: 'bg-green-500/10' },
    { label: 'Pending', value: unpaidCount, icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: 'Collection (Month)', value: `₹${thisMonthCollection.toLocaleString('en-IN')}`, icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-500/10' },
    { label: 'Total Pending ₹', value: `₹${totalPending.toLocaleString('en-IN')}`, icon: IndianRupee, color: 'text-destructive', bg: 'bg-destructive/10' },
    { label: 'Security Deposits', value: `₹${totalDeposits.toLocaleString('en-IN')}`, icon: Wallet, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  ];

  const selectedStudentPayments = selectedStudent
    ? payments.filter(p => p.student_id === selectedStudent.id)
    : [];
  const selectedStudentFees = selectedStudent
    ? fees.filter(f => f.student_id === selectedStudent.id)
    : [];
  const selectedStudentDeposit = selectedStudent
    ? deposits.find(d => d.student_id === selectedStudent.id)
    : undefined;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${s.bg}`}><Icon className={`w-5 h-5 ${s.color}`} /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-lg font-bold text-foreground">{s.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Chart */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><TrendingUp className="w-5 h-5" />Fee Analytics</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Amount']}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center">
            <div className="flex-1 min-w-0 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, User ID, room, or parent mobile..."
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px]"><Filter className="w-4 h-4 mr-2" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportCSV}><Download className="w-4 h-4 mr-2" />Export CSV</Button>
            <Button variant="outline" onClick={() => navigate('/admin/alerts')}><AlertCircle className="w-4 h-4 mr-2" />Alerts</Button>
          </div>
        </CardContent>
      </Card>

      {/* Records */}
      <Card className="bg-card border-border overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-foreground font-bold">Student</TableHead>
                <TableHead className="text-foreground font-bold">User ID</TableHead>
                <TableHead className="text-foreground font-bold hidden lg:table-cell">Room</TableHead>
                <TableHead className="text-foreground font-bold">Monthly</TableHead>
                <TableHead className="text-foreground font-bold">Pending</TableHead>
                <TableHead className="text-foreground font-bold hidden lg:table-cell">Valid Till</TableHead>
                <TableHead className="text-foreground font-bold">Status</TableHead>
                <TableHead className="text-foreground font-bold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No records</TableCell></TableRow>
              ) : filteredRecords.map(r => (
                <TableRow key={r.student.id} className="border-border hover:bg-secondary/30">
                  <TableCell className="font-semibold text-foreground">{r.student.name}</TableCell>
                  <TableCell className="text-foreground">{r.student.username}</TableCell>
                  <TableCell className="text-foreground hidden lg:table-cell">{r.student.room_no || 'N/A'}</TableCell>
                  <TableCell className="text-foreground font-bold">₹{(r.student.fees || 0).toLocaleString('en-IN')}</TableCell>
                  <TableCell className="text-foreground font-bold">₹{r.pending.toLocaleString('en-IN')}</TableCell>
                  <TableCell className="text-foreground hidden lg:table-cell">{r.student.valid_date ? format(parseISO(r.student.valid_date), 'dd MMM yyyy') : 'N/A'}</TableCell>
                  <TableCell>
                    {r.status === 'paid' ? <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Paid</Badge>
                      : r.status === 'partial' ? <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">Partial</Badge>
                      : <Badge variant="destructive">Unpaid</Badge>}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => openProfile(r.student)}><User className="w-4 h-4 mr-1" />Profile</Button>
                    <Button size="sm" onClick={() => openCollect(r.student)}><Plus className="w-4 h-4 mr-1" />Collect</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Mobile */}
      <div className="md:hidden space-y-3">
        {filteredRecords.map(r => (
          <Card key={r.student.id} className="bg-card border-border">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-foreground">{r.student.name}</p>
                  <p className="text-xs text-muted-foreground">{r.student.username} • Room {r.student.room_no || 'N/A'}</p>
                </div>
                {r.status === 'paid' ? <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Paid</Badge>
                  : r.status === 'partial' ? <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">Partial</Badge>
                  : <Badge variant="destructive">Unpaid</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><p className="text-muted-foreground text-xs">Monthly</p><p className="text-foreground font-medium">₹{(r.student.fees || 0).toLocaleString('en-IN')}</p></div>
                <div><p className="text-muted-foreground text-xs">Pending</p><p className="text-foreground font-medium">₹{r.pending.toLocaleString('en-IN')}</p></div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => openProfile(r.student)}><User className="w-4 h-4 mr-1" />Profile</Button>
                <Button size="sm" className="flex-1" onClick={() => openCollect(r.student)}><Plus className="w-4 h-4 mr-1" />Collect</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Collect Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
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
                  <Input value={pMonth} onChange={(e) => setPMonth(e.target.value)} />
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
                <Select value={pMode} onValueChange={(v) => setPMode(v as 'cash' | 'upi' | 'bank')}>
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
              <Button className="w-full" onClick={handleSubmitPayment} disabled={submitting}>
                {submitting ? 'Recording...' : <><Check className="w-4 h-4 mr-2" />Confirm & Download Receipt</>}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Student Profile Dialog */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
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
                            <TableCell><Button size="sm" variant="ghost" onClick={() => reissueReceipt(p, selectedStudent)}><Download className="w-4 h-4" /></Button></TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => { setShowProfileDialog(false); openCollect(selectedStudent); }}>
                  <Plus className="w-4 h-4 mr-2" />Collect Payment
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
