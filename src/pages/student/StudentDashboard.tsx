import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { DashboardSkeleton } from '@/components/ui/dashboard-skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { StudentIDCard } from '@/components/admin/StudentIDCard';
import {
  CalendarCheck,
  MessageSquare,
  Lightbulb,
  CheckCircle,
  Download,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'react-toastify';
import { MealRatingWidget } from '@/components/student/MealRatingWidget';
import { dashboardService } from '@/services/api';

interface StudentData {
  name: string;
  username: string;
  email?: string | null;
  phone?: string | null;
  parent_phone?: string | null;
  room_no: string | null;
  fees: number | null;
  start_date: string | null;
  valid_date: string | null;
  hostel: string | null;
  student_code?: string | null;
  profile_photo?: string | null;
}

export default function StudentDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [stats, setStats] = useState({
    leaveRequests: 0,
    complaints: 0,
    suggestions: 0,
    approvedRequests: 0
  });

  const idCardRef = useRef<HTMLDivElement>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      const response = await dashboardService.getStudentDashboard();
      if (response.success && response.data) {
        setStudentData(response.data.student);
        setStats(response.data.stats);
      }
    } catch (error: any) {
      console.error('Failed to fetch dashboard data:', error);
      toast.error(error.message || 'Failed to load dashboard data');
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, fetchDashboardData]);

  // Download Student ID Card as high-resolution PNG image
  const handleDownloadIDCard = useCallback(async () => {
    const cardElem = document.getElementById('student-id-card-element');
    if (!cardElem) return;
    try {
      toast.info('Generating high-resolution ID card...');
      const html2canvasModule = await import('html2canvas');
      const html2canvas = (html2canvasModule.default || html2canvasModule) as any;
      const canvas = await html2canvas(cardElem, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: null,
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${(studentData?.name || user?.name || 'Student').replace(/\s+/g, '_')}_ID_Card.png`;
      link.href = dataUrl;
      link.click();
      toast.success('ID Card downloaded successfully!');
    } catch (err) {
      console.error('Download ID card error:', err);
      toast.error('Failed to download image. You can use Print ID Card instead.');
    }
  }, [studentData?.name, user?.name]);

  // Print Student ID Card
  const handlePrintIDCard = useCallback(() => {
    const cardElem = document.getElementById('student-id-card-element');
    if (!cardElem) return;
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (!printWindow) {
      toast.error('Please allow popups to print ID card');
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Student ID Card - ${studentData?.name || user?.name || 'Student'}</title>
          <style>
            @page { size: auto; margin: 15mm; }
            body { margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; background: #fff; font-family: sans-serif; }
            @media print {
              body { padding: 0; background: transparent; }
            }
          </style>
        </head>
        <body>
          ${cardElem.outerHTML}
          <script>
            window.onload = function() {
              window.focus();
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [studentData?.name, user?.name]);

  const statCards = useMemo(() => [
    { title: 'Leave Requests', value: stats.leaveRequests, icon: CalendarCheck, color: 'text-primary', bg: 'bg-primary/10 shadow-sm' },
    { title: 'Approved', value: stats.approvedRequests, icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10 shadow-sm' },
    { title: 'Complaints', value: stats.complaints, icon: MessageSquare, color: 'text-amber-500', bg: 'bg-amber-500/10 shadow-sm' },
    { title: 'Suggestions', value: stats.suggestions, icon: Lightbulb, color: 'text-blue-500', bg: 'bg-blue-500/10 shadow-sm' },
  ], [stats]);

  const isValidDate = useMemo(() => {
    return studentData?.valid_date ? new Date(studentData.valid_date) >= new Date() : true;
  }, [studentData?.valid_date]);

  if (loading) {
    return (
      <DashboardLayout title="Dashboard" isAdmin={false}>
        <DashboardSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Dashboard" isAdmin={false}>
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        {/* Compact Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-xl sm:rounded-2xl p-3.5 sm:p-5 shadow-card relative overflow-hidden flex items-center justify-between gap-3"
        >
          <div className="absolute top-0 right-0 w-28 h-28 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="min-w-0">
            <h2 className="text-base sm:text-2xl font-bold text-foreground truncate">
              Welcome back, <span className="text-primary">{studentData?.name || user?.name || 'Student'}</span>! 👋
            </h2>
            <p className="text-muted-foreground text-xs hidden sm:block mt-0.5">
              Here is your official hostel credential and real-time dashboard overview.
            </p>
            <p className="text-muted-foreground text-[11px] sm:hidden truncate mt-0.5">
              {studentData?.room_no ? `Room ${studentData.room_no}` : 'Resident'} • {studentData?.hostel || 'Q2'} Hostel
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
              {isValidDate ? 'Active' : 'Expired'}
            </span>
          </div>
        </motion.div>

        {/* Main Grid: Student ID Card (Directly visible on mobile) + Stats & Meal Rating */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
          {/* LEFT: Official Student ID Card Component */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-5 space-y-3 sm:space-y-4"
          >
            <Card className="bg-card border-border shadow-xl overflow-hidden">
              <CardHeader className="p-3.5 sm:p-4 pb-2 sm:pb-3 border-b border-border/50 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-foreground flex items-center gap-2 text-sm sm:text-base">
                    <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    Official Student ID Card
                  </CardTitle>
                  <CardDescription className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                    Your official resident badge & credential.
                  </CardDescription>
                </div>
                <span className="text-[10px] sm:text-xs text-muted-foreground font-mono bg-secondary/70 px-2 py-0.5 rounded border border-border/40">
                  {studentData?.student_code || ''}
                </span>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-3 space-y-3 sm:space-y-4">
                {/* Rendered Vertical ID Card */}
                <div className="flex justify-center py-0.5">
                  <StudentIDCard
                    ref={idCardRef}
                    name={studentData?.name || user?.name || 'Resident'}
                    email={studentData?.email || user?.email || 'resident@q2hostels.com'}
                    username={studentData?.username || user?.username || 'resident'}
                    roomNo={studentData?.room_no || 'Not Assigned'}
                    hostel={studentData?.hostel || 'Q2'}
                    fees={studentData?.fees ?? 0}
                    startDate={studentData?.start_date}
                    profilePhoto={studentData?.profile_photo || (user as any)?.profilePhoto}
                    studentCode={studentData?.student_code}
                  />
                </div>

                {/* Self-Service Actions: Download PNG & Print */}
                <div className="grid grid-cols-2 gap-2 sm:gap-2.5 pt-0.5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDownloadIDCard}
                    className="h-9 sm:h-10 rounded-xl bg-secondary/80 hover:bg-secondary border-border text-foreground font-semibold text-xs flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm hover:border-primary/40 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                    Download PNG
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrintIDCard}
                    className="h-9 sm:h-10 rounded-xl bg-secondary/80 hover:bg-secondary border-border text-foreground font-semibold text-xs flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm hover:border-primary/40 transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                    Print ID Card
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* RIGHT: Stats Grid & Meal Rating */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-7 space-y-5 sm:space-y-6"
          >
            {/* Stats Grid: 4 Cards in 2x2 grid */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {statCards.map((stat, index) => (
                <StatCard
                  key={stat.title}
                  title={stat.title}
                  value={stat.value}
                  icon={stat.icon}
                  color={stat.color}
                  bg={stat.bg}
                  index={index}
                />
              ))}
            </div>

            {/* Meal Rating Widget */}
            <MealRatingWidget />
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
