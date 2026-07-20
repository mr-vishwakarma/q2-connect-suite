import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { DashboardSkeleton } from '@/components/ui/dashboard-skeleton';
import { api } from '@/lib/api';
import { CalendarCheck, MessageSquare, Lightbulb, CheckCircle, ArrowRight, User, Home, CreditCard, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StudentData {
  name: string;
  username: string;
  room_no: string | null;
  fees: number | null;
  start_date: string | null;
  valid_date: string | null;
  hostel: string | null;
}

export default function StudentDashboard() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [stats, setStats] = useState({
    leaveRequests: 0,
    complaints: 0,
    suggestions: 0,
    approvedRequests: 0
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
    if (!loading && isAdmin) {
      navigate('/admin/dashboard');
    }
  }, [user, loading, isAdmin, navigate]);

  const fetchDashboardData = async () => {
    try {
      const response = await api.get('/dashboard/student');
      if (response.data?.success) {
        setStudentData(response.data.data.student);
        setStats(response.data.data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  if (loading) {
    return <DashboardSkeleton />;
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
    { label: 'Fee History', icon: CreditCard, path: '/student/fees', color: 'text-green-500', bg: 'bg-green-500/10 shadow-sm' },
  ];

  const profileItems = [
    { label: 'Full Name', value: studentData?.name || 'N/A', icon: User },
    { label: 'User ID', value: studentData?.username || 'N/A', icon: Home },
    { label: 'Hostel', value: studentData?.hostel || 'N/A', icon: Home },
    { label: 'Room No', value: studentData?.room_no || 'N/A', icon: Home },
    { label: 'Monthly Fees', value: studentData?.fees != null ? `₹${studentData.fees}` : 'N/A', icon: CreditCard },
    { label: 'Start Date', value: studentData?.start_date ? new Date(studentData.start_date).toLocaleDateString() : 'N/A', icon: Calendar },
    { label: 'End Date', value: studentData?.valid_date ? new Date(studentData.valid_date).toLocaleDateString() : 'N/A', icon: Calendar },
    { label: 'Status', value: studentData?.valid_date && new Date(studentData.valid_date) < new Date() ? 'Expired' : 'Active', icon: CheckCircle, isStatus: true },
  ];

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
            Welcome back, <span className="text-primary">{studentData?.name || 'Student'}</span>! 👋
          </h2>
          <p className="text-muted-foreground">
            Here's an overview of your activity in Q2 Management System.
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="hover:border-primary/50 transition-all duration-300 group cursor-default">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-2xl ${stat.bg} shadow-sm group-hover:shadow-md transition-shadow`}>
                        <Icon className={`w-6 h-6 ${stat.color}`} />
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm text-muted-foreground">{stat.title}</p>
                        <p className={`text-2xl sm:text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Profile + Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Profile */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-card border-border h-full">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Your Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {profileItems.map((item) => {
                  const ItemIcon = item.icon;
                  const isExpired = 'isStatus' in item && item.isStatus && item.value === 'Expired';
                  return (
                    <div key={item.label} className="flex items-center justify-between py-1.5 group">
                      <div className="flex items-center gap-2">
                        <ItemIcon className="w-4 h-4 text-muted-foreground transition-transform duration-500 group-hover:rotate-[360deg]" />
                        <span className="text-muted-foreground text-sm">{item.label}</span>
                      </div>
                      <span className={`font-medium text-sm ${isExpired ? 'text-destructive' : 'text-foreground'}`}>
                        {item.value}
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-card border-border h-full">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-primary" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 sm:gap-3">
                {quickActions.map((action, index) => {
                  const ActionIcon = action.icon;
                  return (
                    <motion.button
                      key={action.label}
                      onClick={() => navigate(action.path)}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + index * 0.1 }}
                      className="p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-all duration-300 text-left group border border-transparent hover:border-primary/30"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-transform duration-500 group-hover:-translate-y-1 shadow-sm group-hover:shadow-md ${action.bg}`}>
                          <ActionIcon className={`w-5 h-5 ${action.color}`} />
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                      </div>
                      <p className="font-semibold text-foreground text-sm sm:text-base">
                        {action.label}
                      </p>
                    </motion.button>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
