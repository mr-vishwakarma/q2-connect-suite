import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  UserCheck,
  UserX,
  Calendar,
  Search,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  Building2,
  Users,
  Percent,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useHostel } from '@/contexts/HostelContext';
import { studentService } from '@/services/api';
import { api } from '@/lib/api';
import { format } from 'date-fns';
import { toast } from 'react-toastify';

interface AttendanceRecord {
  _id?: string;
  userId: { _id: string; name: string; username: string } | string;
  studentId?: string;
  hostel?: string;
  date: string;
  status: 'present' | 'absent' | 'mess_off';
}

export default function AttendanceManagement() {
  const { selectedHostel } = useHostel();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [students, setStudents] = useState<any[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, 'present' | 'absent' | 'mess_off'>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'present' | 'absent' | 'mess_off'>('all');
  const [isLoading, setIsLoading] = useState(true);

  const loadAttendanceData = useCallback(async () => {
    try {
      setIsLoading(true);
      const hostelParam = (selectedHostel as string) !== 'All' ? selectedHostel : undefined;
      const [studentsRes, attRes] = await Promise.all([
        studentService.getStudents({ hostel: hostelParam }),
        api.get('/attendance', { params: { hostel: hostelParam, date: selectedDate } }),
      ]);

      if (studentsRes.success && Array.isArray(studentsRes.data)) {
        setStudents(studentsRes.data);
      }

      const map: Record<string, 'present' | 'absent' | 'mess_off'> = {};
      if (attRes.data?.success && Array.isArray(attRes.data.data)) {
        attRes.data.data.forEach((rec: AttendanceRecord) => {
          const uId = typeof rec.userId === 'object' && rec.userId ? rec.userId._id : (rec.userId as string);
          map[uId] = rec.status;
        });
      }
      setAttendanceRecords(map);
    } catch (error) {
      console.error('Failed to load attendance:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedHostel, selectedDate]);

  useEffect(() => {
    loadAttendanceData();
  }, [loadAttendanceData]);

  const handleMarkAttendance = async (userId: string, studentId: string, status: 'present' | 'absent') => {
    // Optimistic UI update
    setAttendanceRecords((prev) => ({ ...prev, [userId]: status }));

    try {
      const res = await api.post('/attendance', {
        userId,
        studentId,
        hostel: (selectedHostel as string) !== 'All' ? selectedHostel : 'Q2',
        date: selectedDate,
        status,
      });

      if (res.data?.success) {
        toast.success(`Marked ${status}`);
      }
    } catch (error) {
      toast.error('Failed to update attendance');
      loadAttendanceData();
    }
  };

  const handleMarkAllPresent = async () => {
    const promises = students.map((s) => {
      const uId = s.userId || s._id;
      return api.post('/attendance', {
        userId: uId,
        studentId: s._id,
        hostel: s.hostel || selectedHostel || 'Q2',
        date: selectedDate,
        status: 'present',
      });
    });

    try {
      await Promise.all(promises);
      toast.success('All residents marked Present for today!');
      loadAttendanceData();
    } catch (error) {
      toast.error('Failed to mark all present');
    }
  };

  const exportAttendanceCSV = () => {
    const csvContent = [
      ['Student Name', 'Room No', 'Hostel Branch', 'Date', 'Status'].join(','),
      ...students.map((s) => {
        const uId = s.userId || s._id;
        const status = attendanceRecords[uId] || 'unmarked';
        return [
          s.name,
          s.roomNo || 'N/A',
          s.hostel || selectedHostel,
          selectedDate,
          status.toUpperCase(),
        ].join(',');
      }),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${selectedHostel}-${selectedDate}.csv`;
    a.click();
  };

  const filteredStudents = students.filter((s) => {
    const uId = s.userId || s._id;
    const currentStatus = attendanceRecords[uId] || 'unmarked';
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || (s.roomNo && s.roomNo.includes(searchQuery));
    if (!matchesSearch) return false;

    if (filterStatus === 'present') return currentStatus === 'present';
    if (filterStatus === 'absent') return currentStatus === 'absent';
    if (filterStatus === 'mess_off') return currentStatus === 'mess_off';
    return true;
  });

  const presentCount = students.filter((s) => attendanceRecords[s.userId || s._id] === 'present').length;
  const absentCount = students.filter((s) => attendanceRecords[s.userId || s._id] === 'absent').length;
  const messOffCount = students.filter((s) => attendanceRecords[s.userId || s._id] === 'mess_off').length;
  const totalCount = students.length;
  const attendanceRate = totalCount > 0 ? ((presentCount / totalCount) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Daily Attendance & Gate Pass Register</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Track student check-ins, roll calls, evening gate passes, and mess-off leaves.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-card border border-border/80 text-foreground text-xs rounded-xl px-3 py-2"
          />
          <Button onClick={handleMarkAllPresent} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs">
            <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
            Mark All Present
          </Button>
          <Button onClick={exportAttendanceCSV} variant="outline" size="sm" className="text-xs">
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60 bg-gradient-to-br from-emerald-950/20 to-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Present Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-400">{presentCount} <span className="text-xs text-muted-foreground font-normal">/ {totalCount}</span></div>
            <p className="text-[11px] text-emerald-400 mt-1 font-semibold">{attendanceRate}% Rate</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-gradient-to-br from-rose-950/20 to-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Absent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-rose-400">{absentCount}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Unexcused absence</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-gradient-to-br from-amber-950/20 to-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">On Approved Leave</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-amber-400">{messOffCount}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Mess off / Gate Pass</p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Total Registered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{totalCount}</div>
            <p className="text-[11px] text-muted-foreground mt-1">{selectedHostel || 'All Branches'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search resident name or room..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
          <Button
            size="sm"
            variant={filterStatus === 'all' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('all')}
            className="text-xs rounded-full h-8"
          >
            All ({students.length})
          </Button>
          <Button
            size="sm"
            variant={filterStatus === 'present' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('present')}
            className="text-xs rounded-full h-8"
          >
            Present ({presentCount})
          </Button>
          <Button
            size="sm"
            variant={filterStatus === 'absent' ? 'destructive' : 'outline'}
            onClick={() => setFilterStatus('absent')}
            className="text-xs rounded-full h-8"
          >
            Absent ({absentCount})
          </Button>
          <Button
            size="sm"
            variant={filterStatus === 'mess_off' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('mess_off')}
            className="text-xs rounded-full h-8"
          >
            Leave / Mess-Off ({messOffCount})
          </Button>
        </div>
      </div>

      {/* Attendance Roll Call Table */}
      <Card className="border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-secondary/50">
                <TableHead className="text-foreground font-bold">Resident</TableHead>
                <TableHead className="text-foreground font-bold">Room</TableHead>
                <TableHead className="text-foreground font-bold">Phone</TableHead>
                <TableHead className="text-foreground font-bold">Branch</TableHead>
                <TableHead className="text-foreground font-bold">Current Status</TableHead>
                <TableHead className="text-foreground font-bold text-right">Roll Call Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-xs">
                    No residents found matching criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredStudents.map((student) => {
                  const uId = student.userId || student._id;
                  const currentStatus = attendanceRecords[uId] || 'unmarked';

                  return (
                    <TableRow key={student._id} className="border-border hover:bg-secondary/30">
                      <TableCell className="font-semibold text-foreground text-sm">
                        {student.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs font-mono">
                        {student.roomNo || 'N/A'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {student.phone || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {student.hostel || 'Q2'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {currentStatus === 'present' && (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                            <CheckCircle className="w-3 h-3 mr-1" /> Present
                          </Badge>
                        )}
                        {currentStatus === 'absent' && (
                          <Badge variant="destructive" className="text-xs">
                            <XCircle className="w-3 h-3 mr-1" /> Absent
                          </Badge>
                        )}
                        {currentStatus === 'mess_off' && (
                          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                            <Clock className="w-3 h-3 mr-1" /> On Leave
                          </Badge>
                        )}
                        {currentStatus === 'unmarked' && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Unmarked
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => handleMarkAttendance(uId, student._id, 'present')}
                            className={`text-xs px-2.5 h-7 ${
                              currentStatus === 'present'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-secondary text-foreground hover:bg-emerald-600 hover:text-white'
                            }`}
                          >
                            <UserCheck className="w-3 h-3 mr-1" />
                            Present
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleMarkAttendance(uId, student._id, 'absent')}
                            className={`text-xs px-2.5 h-7 ${
                              currentStatus === 'absent'
                                ? 'bg-rose-600 text-white'
                                : 'bg-secondary text-foreground hover:bg-rose-600 hover:text-white'
                            }`}
                          >
                            <UserX className="w-3 h-3 mr-1" />
                            Absent
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
