import { useEffect, useState, useCallback, useRef } from 'react';
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
  ArrowRight,
  User,
  Home,
  CreditCard,
  Calendar,
  Download,
  Printer,
  ShieldCheck,
  Sparkles,
  Bed,
  Phone,
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
  const handleDownloadIDCard = async () => {
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
  };

  // Print Student ID Card
  const handlePrintIDCard = () => {
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
  };

  if (loading) {
    return (
      <DashboardLayout title="Dashboard" isAdmin={false}>
        <DashboardSkeleton />
      </DashboardLayout>
    );
  }

  const statCards = [
    { title: 'Leave Requests', value: stats.leaveRequests, icon: CalendarCheck, color: 'text-primary', bg: 'bg-primary/10 shadow-sm' },
    { title: 'Approved', value: stats.approvedRequests, icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10 shadow-sm' },
    { title: 'Complaints', value: stats.complaints, icon: MessageSquare, color: 'text-amber-500', bg: 'bg-amber-500/10 shadow-sm' },
    { title: 'Suggestions', value: stats.suggestions, icon: Lightbulb, color: 'text-blue-500', bg: 'bg-blue-500/10 shadow-sm' },
  ];

  const quickActions = [
    { label: 'Request Leave', icon: CalendarCheck, path: '/student/mess-off', color: 'text-rose-500', bg: 'bg-rose-500/10 shadow-sm' },
    { label: 'File Complaint', icon: MessageSquare, path: '/student/complaints', color: 'text-amber-500', bg: 'bg-amber-500/10 shadow-sm' },
    { label: 'Submit Suggestion', icon: Lightbulb, path: '/student/suggestions', color: 'text-blue-500', bg: 'bg-blue-500/10 shadow-sm' },
    { label: 'Fee History', icon: CreditCard, path: '/student/fee-history', color: 'text-green-500', bg: 'bg-green-500/10 shadow-sm' },
  ];

  const isValidDate = studentData?.valid_date ? new Date(studentData.valid_date) >= new Date() : true;

  return (
    <DashboardLayout title="Dashboard" isAdmin={false}>
      <div className="space-y-6 animate-fade-in">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-6 shadow-card relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Welcome back, <span className="text-primary">{studentData?.name || user?.name || 'Student'}</span>! 👋
          </h2>
          <p className="text-muted-foreground text-sm">
            Here's an overview of your activity and official hostel credentials in the Q2 Management System.
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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

        {/* Main Grid: Student ID Card (Left) + Resident Summary & Quick Actions (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Official Student ID Card Component */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-5 space-y-4"
          >
            <Card className="bg-card border-border shadow-xl overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground flex items-center gap-2 text-base sm:text-lg">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    Official Student ID Card
                  </CardTitle>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                    {isValidDate ? 'Active' : 'Expired'}
                  </span>
                </div>
                <CardDescription className="text-xs text-muted-foreground">
                  Your official resident credential. You can download or print your physical ID card below.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {/* Rendered Vertical ID Card */}
                <div className="flex justify-center py-1">
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
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDownloadIDCard}
                    className="h-10 rounded-xl bg-secondary/80 hover:bg-secondary border-border text-foreground font-semibold text-xs flex items-center justify-center gap-2 shadow-sm hover:border-primary/40 transition-colors"
                  >
                    <Download className="w-4 h-4 text-primary" />
                    Download PNG
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrintIDCard}
                    className="h-10 rounded-xl bg-secondary/80 hover:bg-secondary border-border text-foreground font-semibold text-xs flex items-center justify-center gap-2 shadow-sm hover:border-primary/40 transition-colors"
                  >
                    <Printer className="w-4 h-4 text-primary" />
                    Print ID Card
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* RIGHT: Quick Resident Summary & Quick Actions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-7 space-y-6"
          >
            {/* Resident Quick Info Card */}
            <Card className="bg-card border-border shadow-xl">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-foreground flex items-center gap-2 text-base">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Resident Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-secondary/50 border border-border/50 space-y-1">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Home className="w-3.5 h-3.5 text-primary" /> Hostel
                  </span>
                  <p className="font-bold text-sm text-foreground">{studentData?.hostel || 'Q2'}</p>
                </div>

                <div className="p-3 rounded-xl bg-secondary/50 border border-border/50 space-y-1">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Bed className="w-3.5 h-3.5 text-primary" /> Room No
                  </span>
                  <p className="font-bold text-sm text-foreground">{studentData?.room_no ? `Room ${studentData.room_no}` : 'Not Assigned'}</p>
                </div>

                <div className="p-3 rounded-xl bg-secondary/50 border border-border/50 space-y-1">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5 text-primary" /> Monthly Fees
                  </span>
                  <p className="font-bold text-sm text-foreground">₹{(studentData?.fees || 0).toLocaleString('en-IN')}</p>
                </div>

                <div className="p-3 rounded-xl bg-secondary/50 border border-border/50 space-y-1">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-primary" /> Valid Until
                  </span>
                  <p className="font-bold text-sm text-foreground">
                    {studentData?.valid_date ? new Date(studentData.valid_date).toLocaleDateString() : 'Active Stay'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions Card */}
            <Card className="bg-card border-border shadow-xl">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-foreground flex items-center gap-2 text-base">
                  <Lightbulb className="w-5 h-5 text-primary" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 grid grid-cols-2 gap-2 sm:gap-3">
                {quickActions.map((action, index) => {
                  const ActionIcon = action.icon;
                  return (
                    <motion.button
                      key={action.label}
                      onClick={() => navigate(action.path)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + index * 0.1 }}
                      className="p-3.5 sm:p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-all duration-300 text-left group border border-border/60 hover:border-primary/40 cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-2 sm:mb-3">
                        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-transform duration-500 group-hover:-translate-y-1 shadow-sm group-hover:shadow-md ${action.bg}`}>
                          <ActionIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${action.color}`} />
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                      </div>
                      <p className="font-semibold text-foreground text-xs sm:text-sm">
                        {action.label}
                      </p>
                    </motion.button>
                  );
                })}
              </CardContent>
            </Card>

            {/* Meal Rating Widget */}
            <MealRatingWidget />
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
