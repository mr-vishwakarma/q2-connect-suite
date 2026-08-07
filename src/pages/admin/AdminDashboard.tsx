import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useHostel } from '@/contexts/HostelContext';
import { StatCard } from '@/components/ui/stat-card';
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
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {statCards.map((stat, index) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            color={stat.color}
            bg={stat.bg}
            link={stat.link}
            index={index}
          />
        ))}
      </div>

      {/* Charts and Recent Items */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Recent Complaints */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="col-span-1"
        >
          <Card className="h-full flex flex-col group card-container">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-foreground text-sm sm:text-lg">New Complaints</CardTitle>
              <button onClick={(e) => {
                const card = e.currentTarget.closest('.card-container');
                if (card) { document.fullscreenElement ? document.exitFullscreen() : card.requestFullscreen(); }
              }} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-secondary rounded">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
              </button>
            </CardHeader>
            <CardContent className="space-y-4 flex-1 overflow-auto">
              {recentComplaints.length > 0 ? (
                recentComplaints.map((item) => (
                  <div key={item._id} className="flex items-start gap-3 p-2 sm:p-3 rounded-xl hover:bg-secondary/50 transition-colors group/item cursor-pointer border border-transparent hover:border-border/50">
                    <div className="p-1.5 sm:p-2 rounded-lg bg-secondary group-hover/item:bg-background transition-colors shrink-0">
                      <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground group-hover/item:text-primary transition-colors" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-foreground group-hover/item:text-primary transition-colors truncate">{item.title}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-xs sm:text-sm p-3">No recent complaints</p>
              )}
              <Button variant="outline" className="w-full mt-auto text-xs sm:text-sm h-8 sm:h-10" asChild>
                <Link to="/admin/complaints">Manage</Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Daily Complaints Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="col-span-1"
        >
          <Card className="h-full flex flex-col group card-container">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-foreground text-sm sm:text-lg flex items-center gap-1 sm:gap-2">
                <span className="text-primary">→</span> Daily Complaints
              </CardTitle>
              <button onClick={(e) => {
                const card = e.currentTarget.closest('.card-container');
                if (card) { document.fullscreenElement ? document.exitFullscreen() : card.requestFullscreen(); }
              }} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-secondary rounded">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
              </button>
            </CardHeader>
            <CardContent className="flex-1 min-h-[150px]">
              <div className="h-full min-h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={complaintsData}>
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickMargin={5} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} width={25} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--card-foreground))',
                        fontSize: '12px'
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
          className="col-span-1"
        >
          <Card className="h-full flex flex-col group card-container">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-foreground text-sm sm:text-lg flex items-center gap-1 sm:gap-2">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" /> Distribution
              </CardTitle>
              <button onClick={(e) => {
                const card = e.currentTarget.closest('.card-container');
                if (card) { document.fullscreenElement ? document.exitFullscreen() : card.requestFullscreen(); }
              }} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-secondary rounded">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
              </button>
            </CardHeader>
            <CardContent className="flex-1 min-h-[150px]">
              <div className="h-full min-h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={studentDistribution.length ? studentDistribution : [{ name: 'No Data', value: 1 }]}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={50}
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
                        color: 'hsl(var(--card-foreground))',
                        fontSize: '12px'
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
          className="col-span-1"
        >
          <Card className="h-full flex flex-col group card-container">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-foreground text-sm sm:text-lg">New Suggestions</CardTitle>
              <button onClick={(e) => {
                const card = e.currentTarget.closest('.card-container');
                if (card) { document.fullscreenElement ? document.exitFullscreen() : card.requestFullscreen(); }
              }} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-secondary rounded">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
              </button>
            </CardHeader>
            <CardContent className="space-y-4 flex-1 overflow-auto">
              {recentSuggestions.length > 0 ? (
                recentSuggestions.map((item) => (
                  <div key={item._id} className="flex items-start gap-3 p-2 sm:p-3 rounded-xl hover:bg-secondary/50 transition-colors group/item cursor-pointer border border-transparent hover:border-border/50">
                    <div className="p-1.5 sm:p-2 rounded-lg bg-secondary group-hover/item:bg-background transition-colors shrink-0">
                      <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground group-hover/item:text-primary transition-colors" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-foreground group-hover/item:text-primary transition-colors truncate">{item.title}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-xs sm:text-sm p-3">No recent suggestions</p>
              )}
              <Button variant="outline" className="w-full mt-auto text-xs sm:text-sm h-8 sm:h-10" asChild>
                <Link to="/admin/suggestions">Manage</Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
