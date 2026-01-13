import { useEffect, useState, useCallback } from 'react';
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
import { Search, DollarSign, Calendar, Check, Filter, Download } from 'lucide-react';
import { format } from 'date-fns';

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
  students?: {
    name: string;
    username: string;
    room_no: string | null;
  };
}

export default function FeeManagement() {
  const { selectedHostel } = useHostel();
  const [fees, setFees] = useState<Fee[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedFee, setSelectedFee] = useState<Fee | null>(null);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'bank'>('upi');

  const currentMonth = format(new Date(), 'MMMM yyyy');

  const fetchFees = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('fees')
      .select(`
        *,
        students (name, username, room_no)
      `)
      .eq('hostel', selectedHostel)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching fees:', error);
    } else {
      setFees(data || []);
    }
    setLoading(false);
  }, [selectedHostel]);

  const fetchStudents = useCallback(async () => {
    const { data } = await supabase
      .from('students')
      .select('id, name, username, room_no, fees, start_date, valid_date')
      .eq('hostel', selectedHostel);

    if (data) {
      setStudents(data);
    }
  }, [selectedHostel]);

  // Initialize fee records for students who don't have one for current month
  const initializeFees = useCallback(async () => {
    for (const student of students) {
      const existingFee = fees.find(
        f => f.student_id === student.id && f.month === currentMonth
      );

      if (!existingFee && student.fees) {
        await supabase.from('fees').insert({
          student_id: student.id,
          month: currentMonth,
          amount: student.fees,
          paid_date: student.start_date,
          payment_mode: 'upi',
          status: 'paid',
          hostel: selectedHostel,
        });
      }
    }
    fetchFees();
  }, [students, fees, currentMonth, selectedHostel, fetchFees]);

  useEffect(() => {
    fetchFees();
    fetchStudents();
  }, [fetchFees, fetchStudents]);

  // Auto-create fees for new students
  useEffect(() => {
    if (students.length > 0 && !loading) {
      // Check if any student is missing fee record
      const missingFees = students.filter(s => 
        !fees.find(f => f.student_id === s.id && f.month === currentMonth)
      );
      if (missingFees.length > 0) {
        initializeFees();
      }
    }
  }, [students, fees, loading, currentMonth, initializeFees]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`fees-${selectedHostel}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fees',
          filter: `hostel=eq.${selectedHostel}`,
        },
        () => fetchFees()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedHostel, fetchFees]);

  const handleMarkAsPaid = async () => {
    if (!selectedFee) return;

    const { error } = await supabase
      .from('fees')
      .update({
        status: 'paid',
        paid_date: new Date().toISOString().split('T')[0],
        payment_mode: paymentMode,
      })
      .eq('id', selectedFee.id);

    if (error) {
      toast.error('Failed to update fee status');
    } else {
      toast.success('Fee marked as paid');
      setShowPaymentDialog(false);
      setSelectedFee(null);
      fetchFees();
    }
  };

  const filteredFees = fees.filter(fee => {
    const matchesSearch = 
      fee.students?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fee.students?.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fee.students?.room_no?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMonth = filterMonth === 'all' || fee.month === filterMonth;
    const matchesStatus = filterStatus === 'all' || fee.status === filterStatus;
    return matchesSearch && matchesMonth && matchesStatus;
  });

  const pendingCount = fees.filter(f => f.status === 'unpaid').length;
  const paidCount = fees.filter(f => f.status === 'paid').length;
  const totalPending = fees.filter(f => f.status === 'unpaid').reduce((sum, f) => sum + f.amount, 0);

  const exportToCSV = () => {
    const headers = ['Student Name', 'User ID', 'Room', 'Month', 'Amount', 'Status', 'Paid Date', 'Payment Mode'];
    const rows = filteredFees.map(fee => [
      fee.students?.name || '',
      fee.students?.username || '',
      fee.students?.room_no || '',
      fee.month,
      fee.amount,
      fee.status,
      fee.paid_date || '',
      fee.payment_mode,
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

  const uniqueMonths = [...new Set(fees.map(f => f.month))];

  return (
    <AdminLayout title="Fee Management">
      <div className="space-y-6 animate-fade-in">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10">
                  <DollarSign className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Records</p>
                  <p className="text-2xl font-bold text-foreground">{fees.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-success/10">
                  <Check className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Paid</p>
                  <p className="text-2xl font-bold text-foreground">{paidCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-warning/10">
                  <Calendar className="w-6 h-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-destructive/10">
                  <DollarSign className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Pending</p>
                  <p className="text-2xl font-bold text-foreground">₹{totalPending}</p>
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
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {uniqueMonths.map(month => (
                    <SelectItem key={month} value={month}>{month}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px]">
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

        {/* Fees Table */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Fee Records</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredFees.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No fee records found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Month</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Paid Date</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFees.map((fee) => (
                      <TableRow key={fee.id}>
                        <TableCell className="font-medium">{fee.students?.name}</TableCell>
                        <TableCell>{fee.students?.username}</TableCell>
                        <TableCell>{fee.students?.room_no || '-'}</TableCell>
                        <TableCell>{fee.month}</TableCell>
                        <TableCell>₹{fee.amount}</TableCell>
                        <TableCell>
                          <Badge variant={fee.status === 'paid' ? 'default' : 'destructive'}>
                            {fee.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{fee.paid_date || '-'}</TableCell>
                        <TableCell className="capitalize">{fee.payment_mode}</TableCell>
                        <TableCell>
                          {fee.status === 'unpaid' && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedFee(fee);
                                setShowPaymentDialog(true);
                              }}
                            >
                              Mark Paid
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Fee as Paid</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Student</p>
              <p className="font-medium">{selectedFee?.students?.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Amount</p>
              <p className="font-medium">₹{selectedFee?.amount}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Payment Mode</p>
              <Select value={paymentMode} onValueChange={(v: 'cash' | 'upi' | 'bank') => setPaymentMode(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleMarkAsPaid}>
              <Check className="w-4 h-4 mr-2" />
              Confirm Payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
