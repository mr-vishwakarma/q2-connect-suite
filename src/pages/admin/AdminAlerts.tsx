import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useHostel } from '@/contexts/HostelContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Download, IndianRupee } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

interface Fee {
  id: string;
  student_id: string;
  status: 'paid' | 'unpaid';
  amount: number;
  month: string;
}

interface AlertStudent {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  room_no: string | null;
  fees: number | null;
  valid_date: string | null;
  start_date: string | null;
  created_at: string;
  daysLeft: number | null;
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

      // Fetch students
      const { data: students } = await supabase
        .from('students')
        .select('id, user_id, name, phone, room_no, fees, valid_date, start_date, created_at')
        .eq('hostel', selectedHostel);

      if (!students) {
        setAlertStudents([]);
        setIsLoading(false);
        return;
      }

      // Fetch fees for these students
      const studentIds = students.map(s => s.id);
      const { data: feesData } = await supabase
        .from('fees')
        .select('student_id, status')
        .in('student_id', studentIds);

      const feeStatusMap = new Map<string, 'paid' | 'unpaid'>();
      feesData?.forEach(fee => {
        // If any fee is unpaid, mark as unpaid
        const current = feeStatusMap.get(fee.student_id);
        if (!current || fee.status === 'unpaid') {
          feeStatusMap.set(fee.student_id, fee.status as 'paid' | 'unpaid');
        }
      });

      const today = new Date();
      const alerts: AlertStudent[] = [];

      students.forEach(student => {
        let daysLeft: number | null = null;
        let status: 'expired' | 'critical' | 'warning' | null = null;
        const feeStatus = feeStatusMap.get(student.id) || 'unpaid';

        if (student.valid_date) {
          const validDate = parseISO(student.valid_date);
          daysLeft = differenceInDays(validDate, today);

          if (daysLeft < 0) {
            status = 'expired';
          } else if (daysLeft <= 2) {
            status = 'critical';
          } else if (daysLeft <= 5) {
            status = 'warning';
          }
        }

        // Show in alerts if:
        // 1. Expired with unpaid fees
        // 2. Critical or warning status
        if ((status === 'expired' && feeStatus === 'unpaid') || status === 'critical' || status === 'warning') {
          alerts.push({
            id: student.id,
            user_id: student.user_id,
            name: student.name,
            phone: student.phone,
            room_no: student.room_no,
            fees: student.fees,
            valid_date: student.valid_date,
            start_date: student.start_date,
            created_at: student.created_at,
            daysLeft,
            status: status!,
            feeStatus,
          });
        }
      });

      alerts.sort((a, b) => {
        // Expired + unpaid first
        if (a.status === 'expired' && a.feeStatus === 'unpaid' && !(b.status === 'expired' && b.feeStatus === 'unpaid')) return -1;
        if (b.status === 'expired' && b.feeStatus === 'unpaid' && !(a.status === 'expired' && a.feeStatus === 'unpaid')) return 1;
        if (a.status === 'expired' && b.status !== 'expired') return -1;
        if (b.status === 'expired' && a.status !== 'expired') return 1;
        if (a.daysLeft !== null && b.daysLeft !== null) return a.daysLeft - b.daysLeft;
        return 0;
      });

      setAlertStudents(alerts);
    } catch (error) {
      console.error('Error fetching alert students:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedHostel]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchAlertStudents();
    }
  }, [user, isAdmin, selectedHostel, fetchAlertStudents]);

  useEffect(() => {
    if (!user || !isAdmin) return;

    const channel = supabase
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isAdmin, selectedHostel, fetchAlertStudents]);

  const exportData = () => {
    const csvContent = [
      ['Name', 'Phone', 'Room No', 'Fees', 'Start Date', 'Valid Till', 'Status', 'Fee Status'].join(','),
      ...alertStudents.map(student => [
        student.name,
        student.phone || 'N/A',
        student.room_no || 'N/A',
        student.fees ? `₹${student.fees}` : 'N/A',
        student.start_date ? format(parseISO(student.start_date), 'dd-MM-yy') : 'N/A',
        student.valid_date ? format(parseISO(student.valid_date), 'dd-MM-yy') : 'N/A',
        student.status === 'expired' ? 'Expired' : `${student.daysLeft} days left`,
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
    // Expired + Unpaid = Show "Unpaid" badge
    if (student.status === 'expired' && student.feeStatus === 'unpaid') {
      return <Badge variant="destructive" className="text-xs">Unpaid</Badge>;
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
      return <Badge variant="default" className="text-xs">Paid</Badge>;
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
  const criticalCount = alertStudents.filter(s => s.status === 'critical').length;
  const warningCount = alertStudents.filter(s => s.status === 'warning').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary">Alert - Expiring Soon & Unpaid</h2>
          <p className="text-muted-foreground">Users with expired validity + unpaid fees, or 5 days or less remaining</p>
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
                <TableHead className="text-foreground font-bold">Fee Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alertStudents.map((student) => (
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
                  <TableCell>{getFeeStatusBadge(student)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {alertStudents.length === 0 && (
            <CardContent className="py-12 text-center">
              <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No alerts at this time</p>
            </CardContent>
          )}
        </Card>
      </motion.div>

      {/* Footer with stats */}
      <div className="flex items-center justify-between text-sm">
        <p className="text-muted-foreground">
          Total Alert Users: <span className="text-primary font-medium">{alertStudents.length}</span>
        </p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            <span className="text-muted-foreground">Expired + Unpaid ({expiredUnpaidCount})</span>
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