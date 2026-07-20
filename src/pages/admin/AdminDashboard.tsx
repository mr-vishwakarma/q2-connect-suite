import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useHostel } from '@/contexts/HostelContext';
import { DashboardSkeleton } from '@/components/ui/dashboard-skeleton';
import { api } from '@/lib/api';
import { Users, MessageSquare, Lightbulb, Clock, ListChecks } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { Link } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';

interface DashboardStats {
  totalStudents: number;
  totalComplaints: number;
  totalSuggestions: number;
}

interface RecentItem {
  _id: string;
  title: string;
  description: string;
  createdAt: string;
  userId?: string;
}

export default function AdminDashboard() {
  const { user, isAdmin, loading } = useAuth();
  const { selectedHostel } = useHostel();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({ totalStudents: 0, totalComplaints: 0, totalSuggestions: 0 });
  const [recentComplaints, setRecentComplaints] = useState<RecentItem[]>([]);
  const [recentSuggestions, setRecentSuggestions] = useState<RecentItem[]>([]);
  const [complaintsData, setComplaintsData] = useState<{ name: string; value: number }[]>([]);
  const [studentDistribution, setStudentDistribution] = useState<{ name: string; value: number }[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate('/admin-login');
    }
  }, [user, isAdmin, loading, navigate]);

  const fetchDashboardData = useCallback(async () => {
    try {
      const response = await api.get('/dashboard/admin', { params: { hostel: selectedHostel } });
      if (response.data?.success) {
        const { stats, recentComplaints, recentSuggestions, complaintsData, studentDistribution } = response.data.data;
        setStats(stats);
        setRecentComplaints(recentComplaints);
        setRecentSuggestions(recentSuggestions);
        setComplaintsData(complaintsData);
        if (studentDistribution) setStudentDistribution(studentDistribution);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  }, [selectedHostel]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchDashboardData();
    }
  }, [user, isAdmin, selectedHostel, fetchDashboardData]);

  useEffect(() => {
    if (!user || !isAdmin) return;

    const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
      withCredentials: true,
    });
    setSocket(newSocket);

    // Whenever any entity relevant to the dashboard updates (like students), we can refetch.
    // For now we'll just listen to general updates if the backend broadcasts them.
    // Let's refetch on 'new-student' or any socket events you have.
    // newSocket.on('student-updated', fetchDashboardData);

    return () => {
      newSocket.disconnect();
    };
  }, [user, isAdmin, selectedHostel, fetchDashboardData]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  const statCards = [
    { title: 'Total Students', value: stats.totalStudents, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10 shadow-sm', link: '/admin/students' },
    { title: 'Total Complaints', value: stats.totalComplaints, icon: MessageSquare, color: 'text-amber-500', bg: 'bg-amber-500/10 shadow-sm', link: '/admin/complaints' },
    { title: 'Total Suggestions', value: stats.totalSuggestions, icon: Lightbulb, color: 'text-green-500', bg: 'bg-green-500/10 shadow-sm', link: '/admin/suggestions' },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-2xl p-6 shadow-card relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Welcome back, <span className="text-primary">{user?.email?.split('@')[0] || 'Admin'}</span>! 👋
          </h1>
          <p className="text-muted-foreground">Manager, {selectedHostel} Hostel</p>
        </div>
        <div className="relative z-10">
          <Button asChild className="gap-2 shadow-sm hover:shadow-md transition-shadow rounded-xl">
            <Link to="/admin/leave-requests">
              <ListChecks className="w-4 h-4" />
              View Leave Records
            </Link>
          </Button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link to={stat.link}>
                <Card className="hover:border-primary/50 transition-all duration-300 cursor-pointer group">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-2xl ${stat.bg} shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:-translate-y-1`}>
                        <Icon className={`w-6 h-6 ${stat.color}`} />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{stat.title}</p>
                        <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Charts and Recent Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Recent Complaints */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground text-lg">New Complaints</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentComplaints.length > 0 ? (
                recentComplaints.map((item) => (
                  <div key={item._id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors group cursor-pointer border border-transparent hover:border-border/50">
                    <div className="p-2 rounded-lg bg-secondary group-hover:bg-background transition-colors">
                      <Clock className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm p-3">No recent complaints</p>
              )}
              <Button variant="outline" className="w-full mt-4" asChild>
                <Link to="/admin/complaints">Manage Complaints</Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Daily Complaints Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground text-lg flex items-center gap-2">
                <span className="text-primary">→</span> Daily Complaints
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={complaintsData}>
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--card-foreground))'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(217 91% 60%)"
                      strokeWidth={2}
                      dot={{ fill: 'hsl(217 91% 60%)', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Student Distribution Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" /> Student Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={studentDistribution.length ? studentDistribution : [{ name: 'No Data', value: 1 }]}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {studentDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['hsl(217 91% 60%)', 'hsl(142 76% 36%)', 'hsl(38 92% 50%)'][index % 3]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--card-foreground))'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Suggestions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground text-lg">New Suggestions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentSuggestions.length > 0 ? (
                recentSuggestions.map((item) => (
                  <div key={item._id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors group cursor-pointer border border-transparent hover:border-border/50">
                    <div className="p-2 rounded-lg bg-secondary group-hover:bg-background transition-colors">
                      <Clock className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm p-3">No recent suggestions</p>
              )}
              <Button variant="outline" className="w-full mt-4" asChild>
                <Link to="/admin/suggestions">Manage Suggestions</Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
