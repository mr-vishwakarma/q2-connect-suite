import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useHostel } from '@/contexts/HostelContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Download } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { differenceInDays, parseISO, format } from 'date-fns';

// Fee status is now derived from valid_date, not from fees table

interface AlertStudent {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  room_no: string | null;
  fees: number | null;
  valid_date: string | null;
  start_date: string | null;
  daysLeft: number | null;
  daysOverdue: number;
  status: 'expired' | 'critical' | 'warning';
  feeStatus: 'paid' | 'unpaid';
}

function AdminAlertsContent() {
  const { user, isAdmin, loading } = useAuth();
  const { selectedHostel } = useHostel();
  const navigate = useNavigate();
  const [alertStudents, setAlertStudents] = useState<AlertStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate('/admin-login');
    }
  }, [user, isAdmin, loading, navigate]);

  const fetchAlertStudents = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch all students from student table (single source of truth)
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id, user_id, name, phone, room_no, fees, valid_date, start_date')
        .eq('hostel', selectedHostel);

      if (studentsError) {
        console.error('Error fetching students:', studentsError);
        setAlertStudents([]);
        setIsLoading(false);
        return;
      }

      if (!students || students.length === 0) {
        setAlertStudents([]);
        setIsLoading(false);
        return;
      }

      // Fee status is now derived from valid_date - no need to fetch fees table

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const alerts: AlertStudent[] = [];

      students.forEach(student => {
        let daysLeft: number | null = null;
        let daysOverdue = 0;
        let status: 'expired' | 'critical' | 'warning' | null = null;
        
        // CRITICAL: Fee status is determined by valid_date
        // If expired = unpaid (regardless of any fee record)
        let feeStatus: 'paid' | 'unpaid' = 'paid';

        if (student.valid_date) {
          const validDate = parseISO(student.valid_date);
          daysLeft = differenceInDays(validDate, today);

          if (daysLeft < 0) {
            status = 'expired';
            daysOverdue = Math.abs(daysLeft);
            // CRITICAL: Expired = Unpaid
            feeStatus = 'unpaid';
          } else if (daysLeft <= 2) {
            status = 'critical';
          } else if (daysLeft <= 5) {
            status = 'warning';
          }
        }

        // Show in alerts if:
        // 1. Status is expired (these are automatically unpaid)
        // 2. Status is critical or warning (expiring soon)
        if (status === 'expired' || status === 'critical' || status === 'warning') {
          alerts.push({
            id: student.id,
            user_id: student.user_id,
            name: student.name,
            phone: student.phone,
            room_no: student.room_no,
            fees: student.fees,
            valid_date: student.valid_date,
            start_date: student.start_date,
            daysLeft,
            daysOverdue,
            status: status || 'expired',
            feeStatus,
          });
        }
      });

      // Sort: Expired + unpaid first, then by days left
      alerts.sort((a, b) => {
        // Priority 1: Expired + unpaid
        const aExpiredUnpaid = a.status === 'expired' && a.feeStatus === 'unpaid';
        const bExpiredUnpaid = b.status === 'expired' && b.feeStatus === 'unpaid';
        if (aExpiredUnpaid && !bExpiredUnpaid) return -1;
        if (bExpiredUnpaid && !aExpiredUnpaid) return 1;
        
        // Priority 2: Expired only
        if (a.status === 'expired' && b.status !== 'expired') return -1;
        if (b.status === 'expired' && a.status !== 'expired') return 1;
        
        // Priority 3: By days left
        if (a.daysLeft !== null && b.daysLeft !== null) return a.daysLeft - b.daysLeft;
        return 0;
      });

      setAlertStudents(alerts);
    } catch (error) {
      console.error('Error fetching alert students:', error);
      setAlertStudents([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedHostel]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchAlertStudents();
    }
  }, [user, isAdmin, selectedHostel, fetchAlertStudents]);

  // Real-time subscription
  useEffect(() => {
    if (!user || !isAdmin) return;

    const studentsChannel = supabase
      .channel(`students-alerts-${selectedHostel}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'students',
          filter: `hostel=eq.${selectedHostel}`,
        },
        () => fetchAlertStudents()
      )
      .subscribe();

    const feesChannel = supabase
      .channel(`fees-alerts-${selectedHostel}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fees',
          filter: `hostel=eq.${selectedHostel}`,
        },
        () => fetchAlertStudents()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(studentsChannel);
      supabase.removeChannel(feesChannel);
    };
  }, [user, isAdmin, selectedHostel, fetchAlertStudents]);

  const exportData = () => {
    const csvContent = [
      ['Name', 'Phone', 'Room No', 'Fees', 'Start Date', 'Valid Till', 'Status', 'Days Overdue', 'Fee Status'].join(','),
      ...alertStudents.map(student => [
        student.name,
        student.phone || 'N/A',
        student.room_no || 'N/A',
        student.fees ? `₹${student.fees}` : 'N/A',
        student.start_date ? format(parseISO(student.start_date), 'dd-MM-yy') : 'N/A',
        student.valid_date ? format(parseISO(student.valid_date), 'dd-MM-yy') : 'N/A',
        student.status === 'expired' ? 'Expired' : `${student.daysLeft} days left`,
        student.daysOverdue > 0 ? `${student.daysOverdue} days` : '-',
        student.feeStatus === 'paid' ? 'Paid' : 'Unpaid',
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alerts-${selectedHostel}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const getStatusBadge = (student: AlertStudent) => {
    if (student.status === 'expired' && student.feeStatus === 'unpaid') {
      return <Badge variant="destructive" className="text-xs">Expired + Unpaid</Badge>;
    }
    if (student.status === 'expired') {
      return <Badge variant="destructive" className="text-xs">Expired</Badge>;
    }
    if (student.status === 'critical') {
      return <Badge className="text-xs bg-orange-500/20 text-orange-500 border-orange-500/30">{student.daysLeft} days left</Badge>;
    }
    return <Badge className="text-xs bg-amber-500/20 text-amber-500 border-amber-500/30">{student.daysLeft} days left</Badge>;
  };

  const getFeeStatusBadge = (student: AlertStudent) => {
    if (student.feeStatus === 'paid') {
      return <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-xs">Paid</Badge>;
    }
    return <Badge variant="destructive" className="text-xs">Unpaid</Badge>;
  };

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const expiredUnpaidCount = alertStudents.filter(s => s.status === 'expired' && s.feeStatus === 'unpaid').length;
  const expiredCount = alertStudents.filter(s => s.status === 'expired').length;
  const criticalCount = alertStudents.filter(s => s.status === 'critical').length;
  const warningCount = alertStudents.filter(s => s.status === 'warning').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary">Alerts - Expired & Pending Students</h2>
          <p className="text-muted-foreground">Students with expired validity, unpaid fees, or validity expiring within 5 days</p>
        </div>
        <Button variant="outline" onClick={exportData} disabled={alertStudents.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Export Data
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="bg-card border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-secondary/50">
                <TableHead className="text-foreground font-bold">Name</TableHead>
                <TableHead className="text-foreground font-bold">Phone</TableHead>
                <TableHead className="text-foreground font-bold">Room No</TableHead>
                <TableHead className="text-foreground font-bold">Fees</TableHead>
                <TableHead className="text-foreground font-bold">Joining Date</TableHead>
                <TableHead className="text-foreground font-bold">Valid Till</TableHead>
                <TableHead className="text-foreground font-bold">Status</TableHead>
                <TableHead className="text-foreground font-bold">Days Overdue</TableHead>
                <TableHead className="text-foreground font-bold">Fee Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alertStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No alerts at this time. All students are up to date!</p>
                  </TableCell>
                </TableRow>
              ) : (
                alertStudents.map((student) => (
                  <TableRow key={student.id} className="border-border hover:bg-secondary/30">
                    <TableCell className="font-medium text-foreground">{student.name}</TableCell>
                    <TableCell className="text-muted-foreground">{student.phone || 'N/A'}</TableCell>
                    <TableCell className="text-muted-foreground">{student.room_no || 'N/A'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {student.fees ? `₹${student.fees.toLocaleString('en-IN')}` : 'N/A'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {student.start_date ? format(parseISO(student.start_date), 'dd-MM-yy') : 'N/A'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {student.valid_date ? format(parseISO(student.valid_date), 'dd-MM-yy') : 'N/A'}
                    </TableCell>
                    <TableCell>{getStatusBadge(student)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {student.daysOverdue > 0 ? (
                        <span className="text-destructive font-medium">{student.daysOverdue} days</span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>{getFeeStatusBadge(student)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </motion.div>

      {/* Footer with stats */}
      <div className="flex items-center justify-between text-sm">
        <p className="text-muted-foreground">
          Total Alert Students: <span className="text-primary font-medium">{alertStudents.length}</span>
        </p>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            <span className="text-muted-foreground">Expired + Unpaid ({expiredUnpaidCount})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-400"></span>
            <span className="text-muted-foreground">Expired ({expiredCount})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-500"></span>
            <span className="text-muted-foreground">Critical ≤2 days ({criticalCount})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
            <span className="text-muted-foreground">Warning 3-5 days ({warningCount})</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminAlerts() {
  return (
    <AdminLayout title="Alerts">
      <AdminAlertsContent />
    </AdminLayout>
  );
}
