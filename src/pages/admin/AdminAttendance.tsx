import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useHostel } from '@/contexts/HostelContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { CalendarCheck, UserCheck, UserX, Users } from 'lucide-react';

interface Student {
  id: string;
  user_id: string;
  name: string;
  room_no: string;
  email: string;
}

interface AttendanceRecord {
  user_id: string;
  status: string;
}

function AdminAttendanceContent() {
  const { user, isAdmin, loading } = useAuth();
  const { selectedHostel } = useHostel();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate('/admin-login');
    }
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchStudents();
      fetchTodayAttendance();
    }
  }, [user, isAdmin, selectedHostel]);

  const fetchStudents = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, name, room_no, email')
        .eq('hostel', selectedHostel)
        .order('room_no', { ascending: true });

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast.error('Failed to fetch students');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTodayAttendance = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('user_id, status')
        .eq('date', today)
        .eq('hostel', selectedHostel);

      if (error) throw error;

      const attendanceMap: { [key: string]: string } = {};
      data?.forEach((record: AttendanceRecord) => {
        attendanceMap[record.user_id] = record.status;
      });
      setAttendance(attendanceMap);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  const markAttendance = (userId: string, status: string) => {
    setAttendance((prev) => ({
      ...prev,
      [userId]: status,
    }));
  };

  const saveAttendance = async () => {
    try {
      setIsSaving(true);

      // Delete existing attendance for today
      await supabase
        .from('attendance')
        .delete()
        .eq('date', today)
        .eq('hostel', selectedHostel);

      // Insert new attendance records
      const records = Object.entries(attendance).map(([user_id, status]) => ({
        user_id,
        status,
        date: today,
        hostel: selectedHostel,
      }));

      if (records.length > 0) {
        const { error } = await supabase.from('attendance').insert(records);
        if (error) throw error;
      }

      toast.success('Attendance saved successfully!');
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast.error('Failed to save attendance');
    } finally {
      setIsSaving(false);
    }
  };

  const presentCount = Object.values(attendance).filter((s) => s === 'present').length;
  const absentCount = Object.values(attendance).filter((s) => s === 'absent').length;

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            Attendance - {selectedHostel}
          </h2>
          <p className="text-muted-foreground text-sm">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <Button variant="hero" onClick={saveAttendance} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Attendance'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{students.length}</p>
              <p className="text-muted-foreground text-sm">Total Students</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-400">{presentCount}</p>
              <p className="text-muted-foreground text-sm">Present</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
              <UserX className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-400">{absentCount}</p>
              <p className="text-muted-foreground text-sm">Absent</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Students List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {students.map((student, index) => (
          <motion.div
            key={student.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
          >
            <Card className="bg-card border-border hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium text-foreground">{student.name}</p>
                    <p className="text-sm text-muted-foreground">Room: {student.room_no || 'N/A'}</p>
                  </div>
                  <Badge variant="outline" className="text-primary border-primary/30">
                    {attendance[student.user_id] || 'Not marked'}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={attendance[student.user_id] === 'present' ? 'default' : 'outline'}
                    onClick={() => markAttendance(student.user_id, 'present')}
                    className={attendance[student.user_id] === 'present' 
                      ? 'bg-green-500 hover:bg-green-600 text-white' 
                      : 'text-green-400 border-green-400/30 hover:bg-green-400/10'
                    }
                  >
                    <UserCheck className="w-4 h-4 mr-1" />
                    Present
                  </Button>
                  <Button
                    size="sm"
                    variant={attendance[student.user_id] === 'absent' ? 'default' : 'outline'}
                    onClick={() => markAttendance(student.user_id, 'absent')}
                    className={attendance[student.user_id] === 'absent' 
                      ? 'bg-red-500 hover:bg-red-600 text-white' 
                      : 'text-red-400 border-red-400/30 hover:bg-red-400/10'
                    }
                  >
                    <UserX className="w-4 h-4 mr-1" />
                    Absent
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {students.length === 0 && (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <CalendarCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No students found in {selectedHostel}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AdminAttendance() {
  return (
    <AdminLayout title="Attendance">
      <AdminAttendanceContent />
    </AdminLayout>
  );
}
