import { InlineSkeletonList } from '@/components/ui/dashboard-skeleton';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useHostel } from '@/contexts/HostelContext';
import { api } from '@/lib/api';
import { io, Socket } from 'socket.io-client';
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
import { toast } from 'react-toastify';

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

import { studentService } from '@/services/api';

export default function AdminAlerts() {
  const { user, isAdmin } = useAuth();
  const { selectedHostel } = useHostel();
  const navigate = useNavigate();
  const [alertStudents, setAlertStudents] = useState<AlertStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAlertStudents = useCallback(async () => {
    try {
      setIsLoading(true);

      const response = await studentService.getAlerts({ hostel: selectedHostel });
      const students = response.success && Array.isArray(response.data) ? response.data : [];

      if (!students || students.length === 0) {
        setAlertStudents([]);
        setIsLoading(false);
        return;
      }
      
      const mappedStudents = students.map((s: any) => ({
        id: s._id,
        user_id: s.userId,
        name: s.name,
        phone: s.phone,
        room_no: s.roomNo,
        fees: s.fees,
        valid_date: s.validDate,
        start_date: s.startDate
      }));

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const alerts: AlertStudent[] = [];

      mappedStudents.forEach(student => {
        let daysLeft: number | null = null;
        let daysOverdue = 0;
        let status: 'expired' | 'critical' | 'warning' | null = null;
        let feeStatus: 'paid' | 'unpaid' = 'paid';

        if (student.valid_date) {
          const validDate = parseISO(student.valid_date);
          daysLeft = differenceInDays(validDate, today);

          if (daysLeft < 0) {
            status = 'expired';
            daysOverdue = Math.abs(daysLeft);
            feeStatus = 'unpaid';
          } else if (daysLeft <= 2) {
            status = 'critical';
          } else if (daysLeft <= 5) {
            status = 'warning';
          }
        }

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

      alerts.sort((a, b) => {
        const aExpiredUnpaid = a.status === 'expired' && a.feeStatus === 'unpaid';
        const bExpiredUnpaid = b.status === 'expired' && b.feeStatus === 'unpaid';
        if (aExpiredUnpaid && !bExpiredUnpaid) return -1;
        if (bExpiredUnpaid && !aExpiredUnpaid) return 1;
        
        if (a.status === 'expired' && b.status !== 'expired') return -1;
        if (b.status === 'expired' && a.status !== 'expired') return 1;
        
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

  useEffect(() => {
    if (!user || !isAdmin) return;

    const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
      withCredentials: true,
    });

    return () => {
      newSocket.disconnect();
    };
  }, [user, isAdmin, selectedHostel]);

  const [filterType, setFilterType] = useState<'all' | 'unpaid' | 'critical' | 'warning'>('all');

  const handleWhatsAppReminder = (student: AlertStudent) => {
    if (!student.phone) {
      toast.error('No phone number registered for this resident');
      return;
    }
    const cleanPhone = student.phone.replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const msg = encodeURIComponent(
      `Hello ${student.name}, this is a gentle reminder from Q2 Girls Hostel management. Your monthly hostel fee of ₹${student.fees || ''} for Room ${student.room_no || ''} is currently ${student.status === 'expired' ? `overdue by ${student.daysOverdue} days` : `due soon on ${student.valid_date ? format(parseISO(student.valid_date), 'dd MMM yyyy') : ''}`}. Please clear your dues or contact the hostel office. Thank you!`
    );
    window.open(`https://api.whatsapp.com/send?phone=${phoneWithCountry}&text=${msg}`, '_blank');
  };

  const handleBulkWhatsApp = () => {
    const overdueWithPhones = alertStudents.filter(s => s.phone && s.status === 'expired');
    if (overdueWithPhones.length === 0) {
      toast.info('No overdue residents with phone numbers found');
      return;
    }
    toast.success(`Broadcasting reminders to ${overdueWithPhones.length} residents...`);
    overdueWithPhones.slice(0, 3).forEach((s, idx) => {
      setTimeout(() => handleWhatsAppReminder(s), idx * 1000);
    });
  };

  const filteredAlertStudents = alertStudents.filter((s) => {
    if (filterType === 'unpaid') return s.status === 'expired' && s.feeStatus === 'unpaid';
    if (filterType === 'critical') return s.status === 'critical';
    if (filterType === 'warning') return s.status === 'warning';
    return true;
  });

  const exportData = () => {
    const csvContent = [
      ['Name', 'Phone', 'Room No', 'Fees', 'Valid Till', 'Status', 'Days Overdue', 'Fee Status'].join(','),
      ...filteredAlertStudents.map(student => [
        student.name,
        student.phone || 'N/A',
        student.room_no || 'N/A',
        student.fees ? `₹${student.fees}` : 'N/A',
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

  if (isLoading) {
    return (
      <div className="py-8"><InlineSkeletonList rows={5} /></div>
    );
  }

  const expiredUnpaidCount = alertStudents.filter(s => s.status === 'expired' && s.feeStatus === 'unpaid').length;
  const expiredCount = alertStudents.filter(s => s.status === 'expired').length;
  const criticalCount = alertStudents.filter(s => s.status === 'critical').length;
  const warningCount = alertStudents.filter(s => s.status === 'warning').length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-2xl font-bold text-primary">Alerts & Fee Reminders</h2>
          <p className="text-muted-foreground text-sm">Automated alerts for expired validities, overdue fees, and expiring resident terms.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handleBulkWhatsApp}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
            disabled={expiredUnpaidCount === 0}
          >
            Broadcast Overdue Reminders ({expiredUnpaidCount})
          </Button>
          <Button variant="outline" onClick={exportData} disabled={alertStudents.length === 0} className="w-full sm:w-auto text-xs">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={filterType === 'all' ? 'default' : 'outline'}
          onClick={() => setFilterType('all')}
          className="rounded-full text-xs font-semibold"
        >
          All Alerts ({alertStudents.length})
        </Button>
        <Button
          size="sm"
          variant={filterType === 'unpaid' ? 'destructive' : 'outline'}
          onClick={() => setFilterType('unpaid')}
          className="rounded-full text-xs font-semibold"
        >
          Expired & Unpaid ({expiredUnpaidCount})
        </Button>
        <Button
          size="sm"
          variant={filterType === 'critical' ? 'default' : 'outline'}
          onClick={() => setFilterType('critical')}
          className="rounded-full text-xs font-semibold"
        >
          Critical ≤ 2 Days ({criticalCount})
        </Button>
        <Button
          size="sm"
          variant={filterType === 'warning' ? 'default' : 'outline'}
          onClick={() => setFilterType('warning')}
          className="rounded-full text-xs font-semibold"
        >
          Warning ≤ 5 Days ({warningCount})
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Mobile Card View */}
        <div className="block md:hidden space-y-3">
          {filteredAlertStudents.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center">
                <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No alerts matching this filter.</p>
              </CardContent>
            </Card>
          ) : (
            filteredAlertStudents.map((student) => (
              <Card key={student.id} className="bg-card border-border">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{student.name}</p>
                      <p className="text-xs text-muted-foreground">{student.phone || 'N/A'}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {getStatusBadge(student)}
                      {getFeeStatusBadge(student)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Room</p>
                      <p className="text-foreground">{student.room_no || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Fees</p>
                      <p className="text-foreground">{student.fees ? `₹${student.fees.toLocaleString('en-IN')}` : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Valid Till</p>
                      <p className="text-foreground text-xs">{student.valid_date ? format(parseISO(student.valid_date), 'dd-MM-yy') : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Days Overdue</p>
                      {student.daysOverdue > 0 ? (
                        <span className="text-destructive font-medium">{student.daysOverdue} days</span>
                      ) : (
                        <span className="text-foreground">-</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-border/50">
                    <Button
                      size="sm"
                      onClick={() => handleWhatsAppReminder(student)}
                      className="w-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      WhatsApp Reminder
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate('/admin/fees')}
                      className="w-full text-xs"
                    >
                      Collect Fee
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <Card className="bg-card border-border overflow-hidden hidden md:block">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-secondary/50">
                  <TableHead className="text-foreground font-bold">Name</TableHead>
                  <TableHead className="text-foreground font-bold hidden lg:table-cell">Phone</TableHead>
                  <TableHead className="text-foreground font-bold">Room No</TableHead>
                  <TableHead className="text-foreground font-bold">Fees</TableHead>
                  <TableHead className="text-foreground font-bold">Valid Till</TableHead>
                  <TableHead className="text-foreground font-bold">Status</TableHead>
                  <TableHead className="text-foreground font-bold hidden lg:table-cell">Days Overdue</TableHead>
                  <TableHead className="text-foreground font-bold">Fee Status</TableHead>
                  <TableHead className="text-foreground font-bold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAlertStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12">
                      <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No alerts matching this filter.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAlertStudents.map((student) => (
                    <TableRow key={student.id} className="border-border hover:bg-secondary/30">
                      <TableCell className="font-medium text-foreground">{student.name}</TableCell>
                      <TableCell className="text-muted-foreground hidden lg:table-cell">{student.phone || 'N/A'}</TableCell>
                      <TableCell className="text-muted-foreground">{student.room_no || 'N/A'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {student.fees ? `₹${student.fees.toLocaleString('en-IN')}` : 'N/A'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {student.valid_date ? format(parseISO(student.valid_date), 'dd-MM-yy') : 'N/A'}
                      </TableCell>
                      <TableCell>{getStatusBadge(student)}</TableCell>
                      <TableCell className="text-muted-foreground hidden lg:table-cell">
                        {student.daysOverdue > 0 ? (
                          <span className="text-destructive font-medium">{student.daysOverdue} days</span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>{getFeeStatusBadge(student)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => handleWhatsAppReminder(student)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-2.5 h-8"
                          >
                            WhatsApp
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate('/admin/fees')}
                            className="text-xs px-2.5 h-8"
                          >
                            Collect
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </motion.div>

      {/* Footer with stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
        <p className="text-muted-foreground">
          Total Alert Students: <span className="text-primary font-medium">{alertStudents.length}</span>
        </p>
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            <span className="text-muted-foreground text-xs sm:text-sm">Expired ({expiredCount})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-500"></span>
            <span className="text-muted-foreground text-xs sm:text-sm">Critical ({criticalCount})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
            <span className="text-muted-foreground text-xs sm:text-sm">Warning ({warningCount})</span>
          </div>
        </div>
      </div>
    </div>
  );
}
