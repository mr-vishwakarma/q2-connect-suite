import { InlineSkeletonList } from '@/components/ui/dashboard-skeleton';
import { CollectPaymentDialog } from './components/CollectPaymentDialog';
import { StudentProfileHistory } from './components/StudentProfileHistory';
import { StudentFeeMatrix, MatrixStudentRecord, FeeStatusType } from './components/StudentFeeMatrix';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHostel } from '@/contexts/HostelContext';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { io } from 'socket.io-client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { toast } from 'react-toastify';
import {
  Search, IndianRupee, Calendar, Check, Filter, Download, TrendingUp,
  AlertCircle, Wallet, Users, FileText, Receipt, Plus, User, Printer,
  LayoutGrid, List, Clock, AlertTriangle, ArrowUpRight, Percent, Building2
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, differenceInDays, addMonths, addDays } from 'date-fns';
import * as XLSX from 'xlsx';
import { downloadReceipt, ReceiptData, downloadHistoryReceipt, HistoryReceiptData, getHistoryReceiptBlob } from '@/lib/receiptPdf';
import { cn } from '@/lib/utils';

const generateMonthOptions = () => {
  const options = [];
  for (let i = -3; i <= 6; i++) {
    options.push(format(addMonths(new Date(), i), 'MMMM yyyy'));
  }
  return options;
};
const MONTH_OPTIONS = generateMonthOptions();

interface Student {
  id: string;
  user_id: string;
  name: string;
  username: string;
  room_no: string | null;
  floor?: string | null;
  profile_photo?: string | null;
  fees: number | null;
  start_date: string | null;
  valid_date: string | null;
  parent_phone?: string | null;
}

interface Fee {
  id: string;
  student_id: string;
  month: string;
  amount: number;
  paid_date: string | null;
  payment_mode: 'cash' | 'upi' | 'bank';
  status: 'paid' | 'unpaid' | 'partial';
  due_date: string | null;
  late_fee: number;
  discount: number;
  paid_amount: number;
  receipt_no: string | null;
  notes: string | null;
}

interface Payment {
  id: string;
  fee_id: string;
  student_id: string;
  receipt_no: string;
  amount: number;
  late_fee: number;
  discount: number;
  security_deposit: number;
  payment_mode: 'cash' | 'upi' | 'bank';
  payment_date: string;
  admin_name: string | null;
  month: string;
  notes: string | null;
}

interface Deposit {
  id: string;
  student_id: string;
  amount: number;
  status: string;
  collected_date: string | null;
  refund_date: string | null;
}

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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'MMMM yyyy'));
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);

  const [lateFeeSetting, setLateFeeSetting] = useState(20);
  const [gracePeriodSetting, setGracePeriodSetting] = useState(5);

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
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchData = useCallback(async () => {
    try {
      const [response, settingsResponse] = await Promise.all([
        api.get('/fees/dashboard', {
          params: {
            hostel: selectedHostel,
            page: currentPage,
            limit: 100, // Load sufficient records for the complete matrix
          },
        }),
        api.get(`/settings/${selectedHostel}`),
      ]);

      if (response.data?.success) {
        const { students, fees, payments, deposits, totalPages, total } = response.data.data;
        setStudents(students || []);
        setFees(fees || []);
        setPayments(payments || []);
        setDeposits(deposits || []);
        setTotalPages(totalPages || 1);
        setTotalStudents(total || (students || []).length);
      }

      if (settingsResponse.data?.success) {
        setLateFeeSetting(settingsResponse.data.data.lateFeePerDay || 20);
        setGracePeriodSetting(settingsResponse.data.data.gracePeriodDays || 5);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load fee data');
    } finally {
      setLoading(false);
    }
  }, [selectedHostel, currentPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!profile) return;
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
      withCredentials: true,
    });
    return () => {
      socket.disconnect();
    };
  }, [selectedHostel, fetchData, profile]);

  // Build matrix records with enhanced status classification
  const records: MatrixStudentRecord[] = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next7Days = addDays(today, 7);

    return students.map((s) => {
      const currentFee = fees.find((f) => f.student_id === s.id && f.month === selectedMonth);
      const studentFees = fees.filter((f) => f.student_id === s.id);
      const isExpired = s.valid_date ? new Date(s.valid_date) < today : false;

      const pending = studentFees
        .filter((f) => f.status !== 'paid')
        .reduce(
          (sum, f) => sum + Math.max(0, f.amount + (f.late_fee || 0) - (f.discount || 0) - (f.paid_amount || 0)),
          0
        );

      let status: FeeStatusType = 'pending';
      const dueDate = currentFee?.due_date ? new Date(currentFee.due_date) : s.valid_date ? new Date(s.valid_date) : null;

      if (currentFee?.status === 'paid' || (pending === 0 && !isExpired && currentFee)) {
        status = 'paid';
      } else if (dueDate) {
        const daysDifference = differenceInDays(today, dueDate);
        if (daysDifference > gracePeriodSetting || isExpired) {
          status = 'overdue';
        } else if (dueDate >= today && dueDate <= next7Days) {
          status = 'upcoming';
        } else {
          status = 'pending';
        }
      } else if (isExpired) {
        status = 'overdue';
      } else {
        status = 'pending';
      }

      return {
        student: s,
        currentFee,
        isExpired,
        pending,
        status,
        dueDate: currentFee?.due_date || s.valid_date,
      };
    });
  }, [students, fees, selectedMonth, gracePeriodSetting]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const q = debouncedSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        r.student.name.toLowerCase().includes(q) ||
        r.student.username.toLowerCase().includes(q) ||
        (r.student.room_no && r.student.room_no.toLowerCase().includes(q)) ||
        (r.student.parent_phone && r.student.parent_phone.includes(q));

      const matchStatus = filterStatus === 'all' || r.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [records, debouncedSearch, filterStatus]);

  // Top 6 KPI summary calculations
  const totalExpectedMonth = useMemo(() => students.reduce((s, x) => s + (x.fees || 0), 0), [students]);

  const thisMonthCollection = useMemo(() => {
    const mS = startOfMonth(new Date());
    const mE = endOfMonth(new Date());
    return payments
      .filter((p) => {
        try {
          return isWithinInterval(parseISO(p.payment_date), { start: mS, end: mE });
        } catch {
          return false;
        }
      })
      .reduce((s, p) => s + Number(p.amount || 0) + Number(p.security_deposit || 0), 0);
  }, [payments]);

  const totalPending = useMemo(() => records.reduce((s, r) => s + r.pending, 0), [records]);

  const overdueAmount = useMemo(() => {
    return records
      .filter((r) => r.status === 'overdue')
      .reduce((s, r) => s + (r.pending > 0 ? r.pending : r.student.fees || 0), 0);
  }, [records]);

  const upcomingAmount = useMemo(() => {
    return records
      .filter((r) => r.status === 'upcoming')
      .reduce((s, r) => s + (r.student.fees || 0), 0);
  }, [records]);

  const collectionRate = useMemo(() => {
    if (!totalExpectedMonth || totalExpectedMonth === 0) return 0;
    const rate = (thisMonthCollection / totalExpectedMonth) * 100;
    return Math.min(100, Math.round(rate * 10) / 10);
  }, [thisMonthCollection, totalExpectedMonth]);

  const paidCount = useMemo(() => records.filter((r) => r.status === 'paid').length, [records]);
  const pendingCount = useMemo(() => records.filter((r) => r.status === 'pending').length, [records]);
  const overdueCount = useMemo(() => records.filter((r) => r.status === 'overdue').length, [records]);
  const upcomingCount = useMemo(() => records.filter((r) => r.status === 'upcoming').length, [records]);

  // Open Collect Payment dialog
  const openCollect = (s: Student) => {
    setSelectedStudent(s);
    const monthly = s.fees || 0;
    setPMonth(selectedMonth);
    setPAmount(monthly);

    const cf = fees.find((f) => f.student_id === s.id && f.month === selectedMonth);
    if (cf?.due_date) {
      const overdue = differenceInDays(new Date(), new Date(cf.due_date));
      setPLateFee(overdue > gracePeriodSetting ? (overdue - gracePeriodSetting) * lateFeeSetting : 0);
    } else {
      setPLateFee(0);
    }
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
    if (pReceived <= 0) {
      toast.error('Enter amount received');
      return;
    }
    setSubmitting(true);

    try {
      const receipt_no = genReceiptNo();

      const studentPayments = [...payments.filter((p) => p.student_id === selectedStudent.id)];
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
        payments: studentPayments,
      };

      const pdfBlob = getHistoryReceiptBlob(receiptData);
      const formData = new FormData();
      formData.append('file', pdfBlob, `receipt-${receipt_no}.pdf`);
      formData.append('folder', `/q2-connect/receipts/students/${selectedStudent.username}`);

      const uploadRes = await api.post('/upload/file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const receiptUrl = uploadRes.data?.url || null;

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
        receiptUrl,
      });

      downloadHistoryReceipt(receiptData);

      toast.success('Payment recorded and receipt generated');
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
    const studentPayments = payments.filter((p) => p.student_id === s.id);
    if (studentPayments.length === 0) {
      toast.error(`No payment receipts found for ${s.name}`);
      return;
    }
    const data: HistoryReceiptData = {
      student_name: s.name,
      username: s.username,
      room_no: s.room_no,
      hostel: selectedHostel,
      payments: studentPayments,
    };
    downloadHistoryReceipt(data);
  };

  const exportXLS = () => {
    const uniqueMonths = Array.from(new Set(payments.map((p) => p.month))).filter(Boolean);
    uniqueMonths.sort((a, b) => new Date(`1 ${a}`).getTime() - new Date(`1 ${b}`).getTime());

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
      ...uniqueMonths,
    ];

    const rows = filteredRecords.map((r) => {
      const studentPayments = payments.filter((p) => p.student_id === r.student.id);
      const totalPaid = studentPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

      const studentDeposit = deposits.find((d) => d.student_id === r.student.id);
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

      uniqueMonths.forEach((month) => {
        const monthTotal = studentPayments
          .filter((p) => p.month === month)
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
      <div className="py-8">
        <InlineSkeletonList rows={6} />
      </div>
    );
  }

  const selectedStudentPayments = selectedStudent
    ? payments.filter((p) => p.student_id === selectedStudent.id)
    : [];
  const selectedStudentFees = selectedStudent
    ? fees.filter((f) => f.student_id === selectedStudent.id)
    : [];
  const selectedStudentDeposit = selectedStudent
    ? deposits.find((d) => d.student_id === selectedStudent.id)
    : undefined;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 6 Top KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Card 1: Total Students */}
        <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-sm hover:border-primary/40 transition-all duration-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground">Total Students</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-foreground font-mono">
              {students.length}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">100% Occupied</p>
          </div>
        </div>

        {/* Card 2: Fees Collected */}
        <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-sm hover:border-primary/40 transition-all duration-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground">Fees Collected</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-emerald-400 font-mono">
              ₹{thisMonthCollection.toLocaleString('en-IN')}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">This Month</p>
          </div>
        </div>

        {/* Card 3: Pending Amount */}
        <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-sm hover:border-primary/40 transition-all duration-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground">Pending Amount</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-rose-400 font-mono">
              ₹{totalPending.toLocaleString('en-IN')}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">This Month</p>
          </div>
        </div>

        {/* Card 4: Overdue Amount */}
        <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-sm hover:border-primary/40 transition-all duration-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground">Overdue Amount</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-amber-400 font-mono">
              ₹{overdueAmount.toLocaleString('en-IN')}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Overdue</p>
          </div>
        </div>

        {/* Card 5: Upcoming Amount */}
        <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-sm hover:border-primary/40 transition-all duration-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground">Upcoming Amount</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-blue-400 font-mono">
              ₹{upcomingAmount.toLocaleString('en-IN')}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Next 7 Days</p>
          </div>
        </div>

        {/* Card 6: Collection Rate */}
        <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-sm hover:border-primary/40 transition-all duration-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground">Collection Rate</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-foreground font-mono">
              {collectionRate}%
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">This Month</p>
          </div>
        </div>
      </div>

      {/* Status Legend & View Switcher Bar */}
      <div className="bg-card/70 border border-border/70 rounded-2xl p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 backdrop-blur-sm shadow-sm">
        {/* Left: Status Legend Indicators */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap text-xs font-medium text-foreground">
          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/40" />
            <span>Paid ({paidCount})</span>
          </div>

          <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-xl">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-500/40" />
            <span>Pending ({pendingCount})</span>
          </div>

          <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xl">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-500/40" />
            <span>Overdue ({overdueCount})</span>
          </div>

          <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-xl">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-blue-500/40" />
            <span>Upcoming ({upcomingCount})</span>
          </div>
        </div>

        {/* Right: Total Counter + Grid/List Switcher */}
        <div className="flex items-center gap-3 self-end lg:self-center">
          <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
            Total: <strong className="text-foreground">{filteredRecords.length} Students</strong>
          </span>

          <div className="bg-secondary/80 border border-border p-0.5 rounded-xl flex items-center shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200',
                viewMode === 'grid'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grid</span>
            </button>

            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200',
                viewMode === 'list'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Action Controls Bar */}
      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center">
            {/* Search Input */}
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search student by name, room, User ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-background"
              />
            </div>

            {/* Month Filter */}
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[170px] h-10 rounded-xl bg-background">
                <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px] h-10 rounded-xl bg-background">
                <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
              </SelectContent>
            </Select>

            {/* Export & Alerts Buttons */}
            <Button variant="outline" onClick={exportXLS} className="h-10 rounded-xl border-border hover:bg-secondary">
              <Download className="w-4 h-4 mr-1.5 text-muted-foreground" />
              Export XLS
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/admin/alerts')}
              className="h-10 rounded-xl border-border hover:bg-secondary"
            >
              <AlertCircle className="w-4 h-4 mr-1.5 text-amber-500" />
              Alerts
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main View: Grid Matrix or Table List */}
      {viewMode === 'grid' ? (
        <StudentFeeMatrix
          records={filteredRecords}
          onSelectStudent={openProfile}
          selectedMonth={selectedMonth}
        />
      ) : (
        <>
          {/* Desktop Table View */}
          <Card className="bg-card border-border overflow-hidden hidden md:block rounded-2xl shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/40 border-border">
                    <TableHead className="text-foreground font-bold">Student</TableHead>
                    <TableHead className="text-foreground font-bold">User ID</TableHead>
                    <TableHead className="text-foreground font-bold hidden lg:table-cell">Room</TableHead>
                    <TableHead className="text-foreground font-bold">Monthly Fee</TableHead>
                    <TableHead className="text-foreground font-bold">Pending Due</TableHead>
                    <TableHead className="text-foreground font-bold hidden lg:table-cell">Valid Till</TableHead>
                    <TableHead className="text-foreground font-bold">Status</TableHead>
                    <TableHead className="text-foreground font-bold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                        No student fee records found matching your filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRecords.map((r) => {
                      const s = r.student;
                      let badge = (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Paid</Badge>
                      );
                      if (r.status === 'pending') {
                        badge = <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30">Pending</Badge>;
                      } else if (r.status === 'overdue') {
                        badge = <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Overdue</Badge>;
                      } else if (r.status === 'upcoming') {
                        badge = <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Upcoming</Badge>;
                      }

                      return (
                        <TableRow key={s.id} className="border-border/60 hover:bg-secondary/30 transition-colors">
                          <TableCell className="font-semibold text-foreground">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0 overflow-hidden">
                                {s.profile_photo ? (
                                  <img src={s.profile_photo} alt={s.name} className="w-full h-full object-cover" />
                                ) : (
                                  s.name.substring(0, 2).toUpperCase()
                                )}
                              </div>
                              <span>{s.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground font-mono text-xs">@{s.username}</TableCell>
                          <TableCell className="text-foreground font-mono text-xs hidden lg:table-cell">
                            {s.room_no || 'N/A'}
                          </TableCell>
                          <TableCell className="text-foreground font-mono font-bold">
                            ₹{(s.fees || 0).toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell className="text-rose-400 font-mono font-bold">
                            ₹{r.pending.toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell className="text-muted-foreground font-mono text-xs hidden lg:table-cell">
                            {s.valid_date ? format(parseISO(s.valid_date), 'dd MMM yyyy') : 'N/A'}
                          </TableCell>
                          <TableCell>{badge}</TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Download Receipt"
                              onClick={() => downloadHistoryForStudent(s)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-primary rounded-lg"
                            >
                              <Printer className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openProfile(s)}
                              className="h-8 text-xs rounded-xl border-border"
                            >
                              <User className="w-3.5 h-3.5 mr-1" />
                              Profile
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => openCollect(s)}
                              className="h-8 text-xs rounded-xl shadow-sm"
                            >
                              <Plus className="w-3.5 h-3.5 mr-1" />
                              Collect
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Mobile List Cards */}
          <div className="md:hidden space-y-3">
            {filteredRecords.map((r) => {
              const s = r.student;
              let badge = (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Paid</Badge>
              );
              if (r.status === 'pending') {
                badge = <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30">Pending</Badge>;
              } else if (r.status === 'overdue') {
                badge = <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Overdue</Badge>;
              } else if (r.status === 'upcoming') {
                badge = <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Upcoming</Badge>;
              }

              return (
                <Card key={s.id} className="bg-card border-border rounded-2xl shadow-sm">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0 overflow-hidden">
                          {s.profile_photo ? (
                            <img src={s.profile_photo} alt={s.name} className="w-full h-full object-cover" />
                          ) : (
                            s.name.substring(0, 2).toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm">{s.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            @{s.username} • Room {s.room_no || 'N/A'}
                          </p>
                        </div>
                      </div>
                      {badge}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-secondary/30 p-2.5 rounded-xl">
                      <div>
                        <p className="text-muted-foreground">Monthly Fee</p>
                        <p className="text-foreground font-mono font-bold">
                          ₹{(s.fees || 0).toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Pending Due</p>
                        <p className="text-rose-400 font-mono font-bold">
                          ₹{r.pending.toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-8 text-xs rounded-xl border-border"
                        onClick={() => downloadHistoryForStudent(s)}
                      >
                        <Printer className="w-3.5 h-3.5 mr-1 text-primary" />
                        Receipt
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-8 text-xs rounded-xl border-border"
                        onClick={() => openProfile(s)}
                      >
                        <User className="w-3.5 h-3.5 mr-1" />
                        Profile
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 h-8 text-xs rounded-xl shadow-sm"
                        onClick={() => openCollect(s)}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Collect
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="text-sm px-4 text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
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

      {/* Expanded Student Profile & Payment History Modal */}
      <StudentProfileHistory
        open={showProfileDialog}
        onOpenChange={setShowProfileDialog}
        selectedStudent={selectedStudent}
        allStudents={students}
        selectedStudentDeposit={selectedStudentDeposit}
        selectedStudentFees={selectedStudentFees}
        selectedStudentPayments={selectedStudentPayments}
        downloadHistoryForStudent={downloadHistoryForStudent}
        openCollect={openCollect}
        onSelectAnotherStudent={openProfile}
      />
    </div>
  );
}
