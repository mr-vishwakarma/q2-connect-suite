import { InlineSkeletonList } from '@/components/ui/dashboard-skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { CollectPaymentDialog } from './components/CollectPaymentDialog';
import { StudentProfileHistory } from './components/StudentProfileHistory';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHostel } from '@/contexts/HostelContext';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { api } from '@/lib/api';
import { io, Socket } from 'socket.io-client';
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { toast } from 'sonner';
import {
  Search, IndianRupee, Calendar, Check, Filter, Download, TrendingUp,
  AlertCircle, Wallet, Users, FileText, Receipt, Plus, User, Printer,
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, differenceInDays, addMonths, subMonths } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';

const generateMonthOptions = () => {
  const options = [];
  for (let i = -3; i <= 6; i++) {
    options.push(format(addMonths(new Date(), i), 'MMMM yyyy'));
  }
  return options;
};
const MONTH_OPTIONS = generateMonthOptions();
import { downloadReceipt, ReceiptData, downloadHistoryReceipt, HistoryReceiptData, getHistoryReceiptBlob } from '@/lib/receiptPdf';

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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset to page 1 on new search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchData = useCallback(async () => {
    try {
      const response = await api.get('/fees/dashboard', { 
        params: { 
          hostel: selectedHostel,
          page: currentPage,
          limit: 20
        } 
      });
      if (response.data?.success) {
        const { students, fees, payments, deposits, totalPages, total } = response.data.data;
        setStudents(students || []);
        setFees(fees || []);
        setPayments(payments || []);
        setDeposits(deposits || []);
        setTotalPages(totalPages || 1);
        setTotalStudents(total || 0);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load fee data');
    } finally {
      setLoading(false);
    }
  }, [selectedHostel, currentPage]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!profile) return;
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
      withCredentials: true,
    });
    
    // Optionally listen to events to refetch data
    // socket.on('fees-updated', fetchData);

    return () => { socket.disconnect(); };
  }, [selectedHostel, fetchData, profile]);

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
      let status: 'paid' | 'unpaid' | 'partial' = 'unpaid';
      if (isExpired) status = 'unpaid';
      else if (currentFee) status = currentFee.status;
      else if (pending > 0) status = 'unpaid';
      return { student: s, currentFee, isExpired, pending, status };
    });
  }, [students, fees, currentMonth]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchSearch = r.student.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        r.student.username.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (r.student.room_no && r.student.room_no.toLowerCase().includes(debouncedSearch.toLowerCase()));
      const matchStatus = filterStatus === 'all' || r.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [records, debouncedSearch, filterStatus]);

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
      const receipt_no = genReceiptNo();
      
      // 1. Prepare history data for the PDF
      const studentPayments = [...payments.filter(p => p.student_id === selectedStudent.id)];
      studentPayments.unshift({
        id: 'new',
        fee_id: '',
        student_id: selectedStudent.id,
        receipt_no,
        payment_date: new Date().toISOString(),
        month: pMonth,
        amount: pReceived,
        payment_mode: pMode,
        admin_name: profile?.name || '',
        notes: pNotes,
        late_fee: pLateFee,
        discount: pDiscount,
        security_deposit: pDeposit,
      });
      
      const receiptData: HistoryReceiptData = {
        student_name: selectedStudent.name,
        username: selectedStudent.username,
        room_no: selectedStudent.room_no,
        hostel: selectedHostel,
        payments: studentPayments
      };

      // 2. Generate PDF Blob and upload to ImageKit
      const pdfBlob = getHistoryReceiptBlob(receiptData);
      const formData = new FormData();
      formData.append('file', pdfBlob, `receipt-${receipt_no}.pdf`);
      formData.append('folder', `/q2-connect/receipts/students/${selectedStudent.username}`);

      const uploadRes = await api.post('/upload/file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const receiptUrl = uploadRes.data?.url || null;

      // 3. Collect payment with receiptUrl
      await api.post('/fees/collect', {
        studentId: selectedStudent.id,
        hostel: selectedHostel,
        month: pMonth,
        amount: pAmount,
        lateFee: pLateFee,
        discount: pDiscount,
        securityDeposit: pDeposit,
        receivedAmount: pReceived,
        paymentMode: pMode,
        notes: pNotes,
        receiptNo: receipt_no,
        receiptUrl
      });

      // 4. Download locally for the admin right away
      downloadHistoryReceipt(receiptData);

      toast.success('Payment recorded, receipt saved and generated');
      setShowPaymentDialog(false);
      fetchData();
    } catch (e: unknown) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadHistoryForStudent = (s: Student) => {
    const studentPayments = payments.filter(p => p.student_id === s.id);
    if (studentPayments.length === 0) {
      toast.error(`No payment receipts found for ${s.name}`);
      return;
    }
    const data: HistoryReceiptData = {
      student_name: s.name, username: s.username, room_no: s.room_no,
      hostel: selectedHostel, payments: studentPayments
    };
    downloadHistoryReceipt(data);
  };

  const exportXLS = () => {
    // 1. Extract all unique months from the payments data to create dynamic columns
    const uniqueMonths = Array.from(new Set(payments.map(p => p.month))).filter(Boolean);
    uniqueMonths.sort((a, b) => new Date(`1 ${a}`).getTime() - new Date(`1 ${b}`).getTime());

    // 2. Build headers
    const headers = [
      'Name', 
      'User ID', 
      'Room', 
      'Monthly Fee (₹)', 
      'Pending Due (₹)', 
      'Total Paid Till Date (₹)', 
      'Security Deposit (₹)',
      'Status', 
      'Valid Till', 
      'Parent Phone',
      ...uniqueMonths
    ];

    // 3. Map rows
    const rows = filteredRecords.map(r => {
      const studentPayments = payments.filter(p => p.student_id === r.student.id);
      const totalPaid = studentPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      
      const studentDeposit = deposits.find(d => d.student_id === r.student.id);
      const depositAmount = studentDeposit ? Number(studentDeposit.amount) : 0;

      const rowData = [
        r.student.name,
        r.student.username,
        r.student.room_no || '',
        r.student.fees || 0,
        r.pending,
        totalPaid,
        depositAmount,
        r.status,
        r.student.valid_date ? format(parseISO(r.student.valid_date), 'dd MMM yyyy') : '',
        r.student.parent_phone || '',
      ];

      // Append payment amount for each specific month
      uniqueMonths.forEach(month => {
        // A student could have multiple payments for a single month, sum them up
        const monthTotal = studentPayments
          .filter(p => p.month === month)
          .reduce((sum, p) => sum + Number(p.amount || 0), 0);
        rowData.push(monthTotal || 0);
      });

      return rowData;
    });
    
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Fee Records');
    
    XLSX.writeFile(workbook, `fee-report-${selectedHostel}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Report exported to Excel with monthly details');
  };

  if (loading) {
    return (
      <div className="py-8"><InlineSkeletonList rows={5} /></div>
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
        {stats.map((s, index) => (
          <StatCard
            key={s.label}
            title={s.label}
            value={s.value}
            icon={s.icon}
            color={s.color}
            bg={s.bg}
            index={index}
            size="sm"
          />
        ))}
      </div>

      {/* Chart */}
      <Card className="hover:border-primary/50 transition-all duration-300">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Fee Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[260px] mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                  axisLine={false} 
                  tickLine={false} 
                  dy={10} 
                />
                <YAxis 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  axisLine={false}
                  tickLine={false}
                  dx={-10}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                  formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Amount']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))', 
                    borderRadius: '12px',
                    color: 'hsl(var(--foreground))',
                    boxShadow: '0 4px 20px hsl(0 0% 0% / 0.1)'
                  }}
                  itemStyle={{ color: 'hsl(var(--primary))', fontWeight: 'bold' }}
                />
                <Bar 
                  dataKey="amount" 
                  fill="url(#colorAmount)" 
                  radius={[6, 6, 0, 0]} 
                  animationDuration={1500}
                />
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
            <Button variant="outline" onClick={exportXLS}><Download className="w-4 h-4 mr-2" />Export XLS</Button>
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
                    <Button size="sm" variant="ghost" title="Download Receipt" onClick={() => downloadHistoryForStudent(r.student)}>
                      <Printer className="w-4 h-4 mr-1 text-primary" />
                    </Button>
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
                <Button size="sm" variant="outline" className="flex-1" onClick={() => downloadHistoryForStudent(r.student)}>
                  <Printer className="w-4 h-4 mr-1 text-primary" />Receipt
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => openProfile(r.student)}><User className="w-4 h-4 mr-1" />Profile</Button>
                <Button size="sm" className="flex-1" onClick={() => openCollect(r.student)}><Plus className="w-4 h-4 mr-1" />Collect</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              <PaginationItem>
                <span className="text-sm px-4 text-muted-foreground">Page {currentPage} of {totalPages}</span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Collect Payment Dialog */}
      <CollectPaymentDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        selectedStudent={selectedStudent}
        pMonth={pMonth}
        setPMonth={setPMonth}
        monthOptions={MONTH_OPTIONS}
        pAmount={pAmount}
        setPAmount={setPAmount}
        pLateFee={pLateFee}
        setPLateFee={setPLateFee}
        pDiscount={pDiscount}
        setPDiscount={setPDiscount}
        pDeposit={pDeposit}
        setPDeposit={setPDeposit}
        pReceived={pReceived}
        setPReceived={setPReceived}
        pMode={pMode}
        setPMode={setPMode}
        pNotes={pNotes}
        setPNotes={setPNotes}
        onSubmit={handleSubmitPayment}
        submitting={submitting}
      />

      {/* Student Profile Dialog */}
      <StudentProfileHistory
        open={showProfileDialog}
        onOpenChange={setShowProfileDialog}
        selectedStudent={selectedStudent}
        selectedStudentDeposit={selectedStudentDeposit}
        selectedStudentFees={selectedStudentFees}
        selectedStudentPayments={selectedStudentPayments}
        downloadHistoryForStudent={downloadHistoryForStudent}
        openCollect={openCollect}
      />
    </div>
  );
}
