import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useHostel } from '@/contexts/HostelContext';
import { supabase } from '@/integrations/supabase/client';
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
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Search, IndianRupee, Calendar, Check, Filter, Download, TrendingUp, AlertCircle, Wallet, Users } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Student {
  id: string;
  name: string;
  username: string;
  room_no: string | null;
  fees: number | null;
  start_date: string | null;
  valid_date: string | null;
}

interface Fee {
  id: string;
  student_id: string;
  month: string;
  amount: number;
  paid_date: string | null;
  payment_mode: 'cash' | 'upi' | 'bank';
  status: 'paid' | 'unpaid';
}

// Combined student with fee data for display
interface StudentFeeRecord {
  studentId: string;
  name: string;
  username: string;
  room_no: string | null;
  fees: number;
  valid_date: string | null;
  start_date: string | null;
  feeId: string | null;
  status: 'paid' | 'unpaid';
  paid_date: string | null;
  payment_mode: 'cash' | 'upi' | 'bank';
  isExpired: boolean;
}

export default function FeeManagement() {
  const { selectedHostel } = useHostel();
  const navigate = useNavigate();
  const [fees, setFees] = useState<Fee[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<StudentFeeRecord | null>(null);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'bank'>('upi');

  const currentMonth = format(new Date(), 'MMMM yyyy');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch students (single source of truth)
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, name, username, room_no, fees, start_date, valid_date')
        .eq('hostel', selectedHostel);

      if (studentsError) {
        console.error('Error fetching students:', studentsError);
        toast.error('Failed to load student data');
        setStudents([]);
      } else {
        setStudents(studentsData || []);
      }

      // Fetch fees for current month
      const { data: feesData, error: feesError } = await supabase
        .from('fees')
        .select('*')
        .eq('hostel', selectedHostel)
        .eq('month', currentMonth);

      if (feesError) {
        console.error('Error fetching fees:', feesError);
        setFees([]);
      } else {
        setFees(feesData || []);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setStudents([]);
      setFees([]);
    } finally {
      setLoading(false);
    }
  }, [selectedHostel, currentMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time subscription for students and fees
  useEffect(() => {
    const studentsChannel = supabase
      .channel(`students-fee-${selectedHostel}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'students',
          filter: `hostel=eq.${selectedHostel}`,
        },
        () => fetchData()
      )
      .subscribe();

    const feesChannel = supabase
      .channel(`fees-${selectedHostel}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fees',
          filter: `hostel=eq.${selectedHostel}`,
        },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(studentsChannel);
      supabase.removeChannel(feesChannel);
    };
  }, [selectedHostel, fetchData]);

  // Build combined student fee records - ONE record per student
  // CRITICAL: Status is determined by valid_date - expired = unpaid
  const studentFeeRecords = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return students.map(student => {
      const studentFee = fees.find(f => f.student_id === student.id);
      const isExpired = student.valid_date ? new Date(student.valid_date) < today : false;
      
      // CRITICAL LOGIC: If valid_date is expired, status is ALWAYS unpaid
      // This is the single source of truth for fee status
      let status: 'paid' | 'unpaid' = 'paid';
      
      if (isExpired) {
        // Expired = Unpaid (regardless of any fee record)
        status = 'unpaid';
      } else if (studentFee) {
        // Not expired - use fee record status if exists
        status = studentFee.status;
      }
      // Not expired and no fee record = paid (has valid subscription)

      return {
        studentId: student.id,
        name: student.name,
        username: student.username,
        room_no: student.room_no,
        fees: student.fees || 0,
        valid_date: student.valid_date,
        start_date: student.start_date,
        feeId: studentFee?.id || null,
        status,
        paid_date: studentFee?.paid_date || student.start_date,
        payment_mode: studentFee?.payment_mode || 'upi',
        isExpired,
      } as StudentFeeRecord;
    });
  }, [students, fees]);

  // Filter records
  const filteredRecords = useMemo(() => {
    return studentFeeRecords.filter(record => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        record.name.toLowerCase().includes(query) ||
        record.username.toLowerCase().includes(query) ||
        (record.room_no?.toLowerCase().includes(query));
      const matchesStatus = filterStatus === 'all' || record.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [studentFeeRecords, searchQuery, filterStatus]);

  // Calculate stats directly from student table - ACCURATE VALUES
  const totalFeeAmount = useMemo(() => 
    students.reduce((sum, s) => sum + (s.fees || 0), 0)
  , [students]);

  const paidRecords = useMemo(() => 
    studentFeeRecords.filter(r => r.status === 'paid')
  , [studentFeeRecords]);

  const unpaidRecords = useMemo(() => 
    studentFeeRecords.filter(r => r.status === 'unpaid')
  , [studentFeeRecords]);

  const totalPendingFee = useMemo(() => 
    unpaidRecords.reduce((sum, r) => sum + r.fees, 0)
  , [unpaidRecords]);

  const thisMonthCollection = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    
    return paidRecords
      .filter(r => {
        if (!r.paid_date) return false;
        try {
          const paidDate = parseISO(r.paid_date);
          return isWithinInterval(paidDate, { start: monthStart, end: monthEnd });
        } catch {
          return false;
        }
      })
      .reduce((sum, r) => sum + r.fees, 0);
  }, [paidRecords]);

  // Chart data
  const chartData = useMemo(() => [
    { name: 'Total Fees', amount: totalFeeAmount, fill: 'hsl(var(--primary))' },
    { name: 'Pending Fees', amount: totalPendingFee, fill: 'hsl(var(--destructive))' },
    { name: 'This Month', amount: thisMonthCollection, fill: 'hsl(142 76% 36%)' },
  ], [totalFeeAmount, totalPendingFee, thisMonthCollection]);

  const handleMarkAsPaid = async () => {
    if (!selectedRecord) return;

    try {
      if (selectedRecord.feeId) {
        // Update existing fee record
        const { error } = await supabase
          .from('fees')
          .update({
            status: 'paid',
            paid_date: new Date().toISOString().split('T')[0],
            payment_mode: paymentMode,
          })
          .eq('id', selectedRecord.feeId);

        if (error) throw error;
      } else {
        // Create new fee record
        const { error } = await supabase
          .from('fees')
          .insert({
            student_id: selectedRecord.studentId,
            month: currentMonth,
            amount: selectedRecord.fees,
            paid_date: new Date().toISOString().split('T')[0],
            payment_mode: paymentMode,
            status: 'paid',
            hostel: selectedHostel,
          });

        if (error) throw error;
      }

      toast.success('Fee marked as paid');
      setShowPaymentDialog(false);
      setSelectedRecord(null);
      fetchData();
    } catch (error) {
      console.error('Error updating fee:', error);
      toast.error('Failed to update fee status');
    }
  };

  const handlePendingClick = () => {
    // Navigate to Alert Section when clicking on Pending
    navigate('/admin/alerts');
  };

  const exportToCSV = () => {
    const headers = ['Student Name', 'User ID', 'Room', 'Amount (₹)', 'Status', 'Paid Date', 'Payment Mode'];
    const rows = filteredRecords.map(record => [
      record.name,
      record.username,
      record.room_no || '',
      record.fees,
      record.status,
      record.paid_date || '',
      record.payment_mode,
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fees-${selectedHostel}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Fee report exported');
  };

  if (loading) {
    return (
      <AdminLayout title="Fee Management">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Fee Management">
      <div className="space-y-6 animate-fade-in">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Wallet className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Fee Amount</p>
                  <p className="text-2xl font-bold text-foreground">₹{totalFeeAmount.toLocaleString('en-IN')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-destructive/10">
                  <AlertCircle className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Pending Fee</p>
                  <p className="text-2xl font-bold text-foreground">₹{totalPendingFee.toLocaleString('en-IN')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-green-500/10">
                  <TrendingUp className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Collection This Month</p>
                  <p className="text-2xl font-bold text-foreground">₹{thisMonthCollection.toLocaleString('en-IN')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Graph */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Fee Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickFormatter={(value) => `₹${value.toLocaleString('en-IN')}`}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Amount']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))'
                    }}
                  />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards with Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Records</p>
                  <p className="text-2xl font-bold text-foreground">{String(students.length).padStart(2, '0')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-green-500/10">
                  <Check className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Paid</p>
                  <p className="text-2xl font-bold text-foreground">{String(paidRecords.length).padStart(2, '0')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card 
            className="bg-card border-border cursor-pointer hover:bg-secondary/50 transition-colors"
            onClick={handlePendingClick}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-amber-500/10">
                  <Calendar className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-foreground">{String(unpaidRecords.length).padStart(2, '0')}</p>
                  <p className="text-xs text-primary">Click to view alerts →</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-destructive/10">
                  <IndianRupee className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Amount</p>
                  <p className="text-2xl font-bold text-foreground">₹{totalPendingFee.toLocaleString('en-IN')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, user ID, or room..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={exportToCSV}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Fee Table */}
        <Card className="bg-card border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-secondary/50">
                <TableHead className="text-foreground font-bold">Student Name</TableHead>
                <TableHead className="text-foreground font-bold">User ID</TableHead>
                <TableHead className="text-foreground font-bold">Room</TableHead>
                <TableHead className="text-foreground font-bold">Amount</TableHead>
                <TableHead className="text-foreground font-bold">Valid Till</TableHead>
                <TableHead className="text-foreground font-bold">Status</TableHead>
                <TableHead className="text-foreground font-bold">Payment Mode</TableHead>
                <TableHead className="text-foreground font-bold text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No fee records found
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((record) => (
                  <TableRow key={record.studentId} className="border-border hover:bg-secondary/30">
                    <TableCell className="font-medium text-foreground">{record.name}</TableCell>
                    <TableCell className="text-muted-foreground">{record.username}</TableCell>
                    <TableCell className="text-muted-foreground">{record.room_no || 'N/A'}</TableCell>
                    <TableCell className="text-foreground font-medium">₹{record.fees.toLocaleString('en-IN')}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {record.valid_date ? format(parseISO(record.valid_date), 'dd MMM yyyy') : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {record.status === 'paid' ? (
                        <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Paid</Badge>
                      ) : (
                        <Badge variant="destructive">Unpaid</Badge>
                      )}
                      {record.isExpired && record.status === 'unpaid' && (
                        <Badge variant="destructive" className="ml-1 text-xs">Expired</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground uppercase">{record.payment_mode}</TableCell>
                    <TableCell className="text-right">
                      {record.status === 'unpaid' && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedRecord(record);
                            setShowPaymentDialog(true);
                          }}
                        >
                          Mark Paid
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Payment Dialog */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">Record Payment</DialogTitle>
            </DialogHeader>
            {selectedRecord && (
              <div className="space-y-4">
                <div className="p-4 bg-secondary rounded-lg">
                  <p className="text-sm text-muted-foreground">Student</p>
                  <p className="text-lg font-medium text-foreground">{selectedRecord.name}</p>
                </div>
                <div className="p-4 bg-secondary rounded-lg">
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="text-2xl font-bold text-primary">₹{selectedRecord.fees.toLocaleString('en-IN')}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Payment Mode</label>
                  <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as 'cash' | 'upi' | 'bank')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={handleMarkAsPaid}>
                  <Check className="w-4 h-4 mr-2" />
                  Confirm Payment
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
