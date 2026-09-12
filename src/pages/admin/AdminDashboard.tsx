import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useHostel } from '@/contexts/HostelContext';
import { dashboardService } from '@/services/api';
import { useQuery } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import {
  Users,
  MessageSquare,
  Lightbulb,
  ListChecks,
  ChevronRight,
  ChevronDown,
  Droplets,
  Wifi,
  Zap,
  Sparkles,
  Utensils,
  Home,
  BarChart2,
  Star,
  FileText,
  Calendar,
  MessageSquareDiff,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface DashboardStats {
  totalStudents: number;
  totalComplaints: number;
  totalSuggestions: number;
  studentsTrend?: string;
  complaintsTrend?: string;
  suggestionsTrend?: string;
}

interface RecentComplaint {
  _id: string;
  title: string;
  description: string;
  createdAt: string;
  category?: string;
  tag?: string;
  isNew?: boolean;
}

interface RecentSuggestion {
  _id: string;
  title: string;
  description: string;
  createdAt: string;
}

export default function AdminDashboard() {
  const { user, profile, isAdmin, loading: authLoading } = useAuth();
  const { selectedHostel } = useHostel();
  const navigate = useNavigate();
  const [socket, setSocket] = useState<Socket | null>(null);

  const { data: dashboardData, isLoading: isDashboardLoading } = useQuery({
    queryKey: ['adminDashboard', selectedHostel],
    queryFn: async () => {
      const response = await dashboardService.getAdminDashboard({ hostel: selectedHostel });
      return response.data;
    },
    staleTime: 60 * 1000,
    enabled: !!(user && isAdmin),
  });

  const stats: DashboardStats = dashboardData?.stats || {
    totalStudents: 0,
    totalComplaints: 0,
    totalSuggestions: 0,
    studentsTrend: '+0%',
    complaintsTrend: '+0%',
    suggestionsTrend: '+0%',
  };

  const complaintsSummary = dashboardData?.complaintsSummary || {
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
  };

  const recentComplaints: RecentComplaint[] = dashboardData?.recentComplaints || [];
  const recentSuggestions: RecentSuggestion[] = dashboardData?.recentSuggestions || [];
  const complaintsData = dashboardData?.complaintsData || [];
  const allocation = dashboardData?.allocationDistribution || {
    total: stats.totalStudents || 0,
    allocated: stats.totalStudents || 0,
    pending: 0,
    vacant: 0,
  };
  const ratingSummary = dashboardData?.ratingSummary || {
    averageRating: 0,
    totalRatings: 0,
  };

  useEffect(() => {
    if (!user || !isAdmin) return;

    const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
      withCredentials: true,
    });
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user, isAdmin, selectedHostel]);

  // Manager display name
  const managerName = profile?.name || user?.email?.split('@')[0] || 'Manager';

  // Category Icon helper
  const getCategoryIcon = (category?: string) => {
    const cat = (category || 'Room').toLowerCase();
    if (cat.includes('water')) return <Droplets className="w-4 h-4 text-sky-400" />;
    if (cat.includes('wifi')) return <Wifi className="w-4 h-4 text-cyan-400" />;
    if (cat.includes('elec')) return <Zap className="w-4 h-4 text-amber-400" />;
    if (cat.includes('clean')) return <Sparkles className="w-4 h-4 text-emerald-400" />;
    if (cat.includes('mess') || cat.includes('food')) return <Utensils className="w-4 h-4 text-rose-400" />;
    return <Home className="w-4 h-4 text-indigo-400" />;
  };

  // Donut data calculation
  const totalAllocCapacity = (allocation.allocated + allocation.pending + allocation.vacant) || (stats.totalStudents || 1);
  const allocatedPct = totalAllocCapacity > 0 ? Math.round((allocation.allocated / totalAllocCapacity) * 100) : 0;
  const pendingPct = totalAllocCapacity > 0 ? Math.round((allocation.pending / totalAllocCapacity) * 100) : 0;
  const vacantPct = totalAllocCapacity > 0 ? Math.round((allocation.vacant / totalAllocCapacity) * 100) : 0;

  const donutData = [
    { name: 'Allocated', value: allocation.allocated || (stats.totalStudents ? stats.totalStudents : 1), color: '#3b82f6' },
    { name: 'Pending', value: allocation.pending || 0, color: '#a855f7' },
    { name: 'Vacant', value: allocation.vacant || 0, color: '#64748b' },
  ];

  return (
    <div className="space-y-4 sm:space-y-5 pb-8 max-w-7xl mx-auto">
      {/* 1. HERO BANNER */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-white/5 bg-gradient-to-r from-[#170e14] via-[#121622] to-[#14121a] p-5 sm:p-7 shadow-2xl"
      >
        {/* Ambient Red Glow Aura */}
        <div className="pointer-events-none absolute -top-10 -left-10 w-60 h-60 rounded-full bg-red-600/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 right-16 w-72 h-72 rounded-full bg-red-600/20 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* Left Text & Action */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight">
              Welcome back, <span className="text-red-500 font-extrabold">{managerName}</span>! 👋
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Manager, {selectedHostel || 'Q2'} Hostel
            </p>
            <p className="text-[11px] sm:text-xs text-zinc-400/80 italic mt-1.5">
              “A well-managed hostel builds brighter futures.”
            </p>
            <div className="mt-4">
              <Button
                asChild
                className="bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl px-4 sm:px-5 py-2 sm:py-2.5 h-auto shadow-lg shadow-red-600/30 gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] text-xs sm:text-sm"
              >
                <Link to="/admin/leave-requests">
                  <ListChecks className="w-4 h-4" />
                  View Leave Records
                </Link>
              </Button>
            </div>
          </div>

          {/* Right Text & 3D Building artwork */}
          <div className="flex items-center gap-4 self-center md:self-auto w-full md:w-auto justify-between md:justify-end">
            {/* Top Right Tagline */}
            <div className="text-right shrink-0">
              <p className="text-[10px] sm:text-xs text-zinc-400 uppercase tracking-wider font-medium">Manage Today</p>
              <p className="text-xs sm:text-sm font-bold text-white leading-tight">For a Better</p>
              <p className="text-xs sm:text-sm font-bold text-white leading-tight">Tomorrow</p>
              <div className="w-7 sm:w-9 h-[2px] bg-red-500 ml-auto mt-1 rounded-full" />
            </div>

            {/* 3D Isometric Hostel Building with Radial Glow */}
            <div className="relative flex items-center justify-center w-36 h-32 sm:w-44 sm:h-40 md:w-48 md:h-44 shrink-0">
              {/* Central ambient red aura */}
              <div
                className="absolute inset-0 m-auto w-32 h-32 sm:w-40 sm:h-40 rounded-full pointer-events-none"
                style={{
                  background: 'radial-gradient(circle, rgba(239, 68, 68, 0.45) 0%, rgba(220, 38, 38, 0.2) 45%, transparent 75%)',
                  filter: 'blur(12px)',
                }}
              />
              <img
                src="/assets/hostel-3d-building.png"
                alt="Hostel 3D View"
                className="relative z-10 w-full h-full object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.7)]"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* 2. 3 METRIC STAT CARDS ROW (Maintains 3-column row on mobile!) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 md:gap-5">
        {/* Card 1: Total Students */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onClick={() => navigate('/admin/students')}
          className="cursor-pointer group rounded-2xl bg-card border border-border/50 p-3 sm:p-4 hover:border-blue-500/40 hover:bg-card/90 transition-all shadow-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
          <p className="text-[11px] sm:text-xs text-muted-foreground font-medium truncate">Total Students</p>
          <p className="text-lg sm:text-2xl font-extrabold text-blue-400 mt-0.5">
            {stats.totalStudents}
          </p>
          <div className="mt-1 flex items-center flex-wrap gap-1">
            <span className="text-[10px] sm:text-xs font-semibold text-emerald-400">
              ↑ {stats.studentsTrend || '+0%'}
            </span>
            <span className="text-[9px] sm:text-[10px] text-muted-foreground hidden sm:inline">from last month</span>
          </div>
        </motion.div>

        {/* Card 2: Total Complaints */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          onClick={() => navigate('/admin/complaints')}
          className="cursor-pointer group rounded-2xl bg-card border border-border/50 p-3 sm:p-4 hover:border-amber-500/40 hover:bg-card/90 transition-all shadow-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
          <p className="text-[11px] sm:text-xs text-muted-foreground font-medium truncate">Total Complaints</p>
          <p className="text-lg sm:text-2xl font-extrabold text-amber-400 mt-0.5">
            {stats.totalComplaints}
          </p>
          <div className="mt-1 flex items-center flex-wrap gap-1">
            <span className="text-[10px] sm:text-xs font-semibold text-emerald-400">
              ↓ {stats.complaintsTrend || '-50%'}
            </span>
            <span className="text-[9px] sm:text-[10px] text-muted-foreground hidden sm:inline">from last month</span>
          </div>
        </motion.div>

        {/* Card 3: Total Suggestions */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onClick={() => navigate('/admin/suggestions')}
          className="cursor-pointer group rounded-2xl bg-card border border-border/50 p-3 sm:p-4 hover:border-emerald-500/40 hover:bg-card/90 transition-all shadow-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
          <p className="text-[11px] sm:text-xs text-muted-foreground font-medium truncate">Total Suggestions</p>
          <p className="text-lg sm:text-2xl font-extrabold text-emerald-400 mt-0.5">
            {stats.totalSuggestions}
          </p>
          <div className="mt-1 flex items-center flex-wrap gap-1">
            <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground">
              {stats.suggestionsTrend || '+0%'}
            </span>
            <span className="text-[9px] sm:text-[10px] text-muted-foreground hidden sm:inline">from last month</span>
          </div>
        </motion.div>
      </div>

      {/* 3. ROW 2: NEW COMPLAINTS + DAILY COMPLAINTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {/* NEW COMPLAINTS CARD */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="rounded-2xl border-border/50 bg-card flex flex-col h-full shadow-sm">
            <CardHeader className="p-4 sm:p-5 pb-3 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                  <FileText className="w-4 h-4" />
                </div>
                <CardTitle className="text-sm sm:text-base font-bold text-foreground">
                  New Complaints
                </CardTitle>
              </div>
              <Link
                to="/admin/complaints"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 font-medium transition-colors"
              >
                <span>View All</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 pt-0 flex-1 flex flex-col justify-between space-y-3">
              <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[260px]">
                {recentComplaints.length > 0 ? (
                  recentComplaints.slice(0, 3).map((item) => (
                    <div
                      key={item._id}
                      onClick={() => navigate('/admin/complaints')}
                      className="p-3 rounded-xl bg-secondary/30 hover:bg-secondary/60 border border-border/40 transition-all cursor-pointer space-y-2"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-secondary/70 border border-border/40 flex items-center justify-center shrink-0 mt-0.5">
                          {getCategoryIcon(item.category)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
                              {item.title}
                            </p>
                            {item.isNew && (
                              <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider shrink-0">
                                New
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {item.description || 'No description provided.'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-border/20 text-[10px] sm:text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(item.createdAt).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground font-medium border border-border/40">
                          {item.tag || item.category || 'Room'}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-muted-foreground text-xs">
                    <p>No recent complaints logged.</p>
                  </div>
                )}
              </div>

              {/* Footer Button: Manage Complaints */}
              <Link
                to="/admin/complaints"
                className="w-full mt-auto py-2.5 px-4 bg-secondary/40 hover:bg-secondary/80 border border-border/50 rounded-xl text-xs sm:text-sm font-medium flex items-center justify-between transition-colors text-foreground"
              >
                <span>Manage Complaints</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        {/* DAILY COMPLAINTS CHART CARD */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="rounded-2xl border-border/50 bg-card flex flex-col h-full shadow-sm">
            <CardHeader className="p-4 sm:p-5 pb-2 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                  <BarChart2 className="w-4 h-4" />
                </div>
                <CardTitle className="text-sm sm:text-base font-bold text-foreground">
                  Daily Complaints
                </CardTitle>
              </div>
              <div className="flex items-center gap-1 text-[11px] sm:text-xs text-muted-foreground bg-secondary/50 border border-border/50 px-2.5 py-1 rounded-lg">
                <span>Last 7 Days</span>
                <ChevronDown className="w-3 h-3 ml-0.5" />
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 pt-0 flex-1 flex flex-col justify-between">
              {/* Glowing Red Curve Chart */}
              <div className="h-[140px] sm:h-[155px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={complaintsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="complaintRedGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                        <stop offset="90%" stopColor="#ef4444" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="name"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      tickLine={false}
                      axisLine={{ stroke: 'hsl(var(--border) / 0.4)' }}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#121622',
                        border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: '10px',
                        color: '#fff',
                        fontSize: '11px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                      }}
                      itemStyle={{ color: '#ef4444' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#ef4444"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#complaintRedGlow)"
                      dot={{ r: 3.5, fill: '#ef4444', stroke: '#ff0033', strokeWidth: 1 }}
                      activeDot={{ r: 5, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Bottom 3 Summary Boxes (Today / This Week / This Month) */}
              <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-border/30">
                <div className="bg-[#111622] border border-border/40 rounded-xl py-2 px-1 text-center">
                  <p className="text-sm sm:text-base font-bold text-white leading-tight">
                    {complaintsSummary.today}
                  </p>
                  <p className="text-[10px] sm:text-xs text-zinc-400 mt-0.5">Today</p>
                </div>
                <div className="bg-[#111622] border border-border/40 rounded-xl py-2 px-1 text-center">
                  <p className="text-sm sm:text-base font-bold text-white leading-tight">
                    {complaintsSummary.thisWeek}
                  </p>
                  <p className="text-[10px] sm:text-xs text-zinc-400 mt-0.5">This Week</p>
                </div>
                <div className="bg-[#111622] border border-border/40 rounded-xl py-2 px-1 text-center">
                  <p className="text-sm sm:text-base font-bold text-white leading-tight">
                    {complaintsSummary.thisMonth}
                  </p>
                  <p className="text-[10px] sm:text-xs text-zinc-400 mt-0.5">This Month</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* 4. ROW 3: DISTRIBUTION + NEW SUGGESTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {/* DISTRIBUTION CARD */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Card className="rounded-2xl border-border/50 bg-card flex flex-col h-full shadow-sm">
            <CardHeader className="p-4 sm:p-5 pb-3 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                  <Users className="w-4 h-4" />
                </div>
                <CardTitle className="text-sm sm:text-base font-bold text-foreground">
                  Distribution
                </CardTitle>
              </div>
              <div className="flex items-center gap-1 text-[11px] sm:text-xs text-muted-foreground bg-secondary/50 border border-border/50 px-2.5 py-1 rounded-lg">
                <span>Students</span>
                <ChevronDown className="w-3 h-3 ml-0.5" />
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 pt-0 flex-1 flex items-center justify-between gap-4">
              {/* Donut Chart with Center Text */}
              <div className="relative w-[140px] h-[140px] sm:w-[160px] sm:h-[160px] shrink-0 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={46}
                      outerRadius={66}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`donut-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-lg sm:text-xl font-extrabold text-foreground leading-tight">
                    {allocation.total || stats.totalStudents}
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-muted-foreground font-medium">Total</span>
                </div>
              </div>

              {/* Legend with percentages */}
              <div className="flex-1 space-y-2.5 pr-2">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                    <span className="text-muted-foreground">Allocated</span>
                  </div>
                  <span className="font-bold text-foreground">
                    {allocation.allocated} ({allocatedPct}%)
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
                    <span className="text-muted-foreground">Pending</span>
                  </div>
                  <span className="font-bold text-foreground">
                    {allocation.pending} ({pendingPct}%)
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-500 shrink-0" />
                    <span className="text-muted-foreground">Vacant</span>
                  </div>
                  <span className="font-bold text-foreground">
                    {allocation.vacant} ({vacantPct}%)
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* NEW SUGGESTIONS CARD */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="rounded-2xl border-border/50 bg-card flex flex-col h-full shadow-sm">
            <CardHeader className="p-4 sm:p-5 pb-3 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Lightbulb className="w-4 h-4" />
                </div>
                <CardTitle className="text-sm sm:text-base font-bold text-foreground">
                  New Suggestions
                </CardTitle>
              </div>
              <Link
                to="/admin/suggestions"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 font-medium transition-colors"
              >
                <span>View All</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 pt-0 flex-1 flex flex-col justify-between">
              {recentSuggestions.length > 0 ? (
                <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[160px]">
                  {recentSuggestions.map((item) => (
                    <div
                      key={item._id}
                      onClick={() => navigate('/admin/suggestions')}
                      className="p-2.5 rounded-xl bg-secondary/30 hover:bg-secondary/60 border border-border/40 transition-all cursor-pointer"
                    >
                      <p className="text-xs sm:text-sm font-semibold text-foreground truncate">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground line-clamp-1">{item.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-secondary/40 border border-border/40 flex items-center justify-center text-muted-foreground/60 mb-2">
                    <MessageSquareDiff className="w-6 h-6" />
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-foreground">No recent suggestions</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                    Suggestions from students will appear here.
                  </p>
                </div>
              )}

              {/* Footer Button: Manage Suggestions */}
              <Link
                to="/admin/suggestions"
                className="w-full mt-auto py-2.5 px-4 bg-secondary/40 hover:bg-secondary/80 border border-border/50 rounded-xl text-xs sm:text-sm font-medium flex items-center justify-between transition-colors text-foreground"
              >
                <span>Manage Suggestions</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* 5. ROW 4: MENU RATINGS OVERVIEW CARD */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
      >
        <Card className="rounded-2xl border-border/50 bg-card shadow-sm">
          <CardHeader className="p-4 sm:p-5 pb-3 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2.5">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              <CardTitle className="text-sm sm:text-base font-bold text-foreground">
                Menu Ratings Overview
              </CardTitle>
            </div>
            <Link
              to="/admin/analytics"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 font-medium transition-colors"
            >
              <span>View Details</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </CardHeader>

          <CardContent className="p-4 sm:p-5 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              {/* Left: Score & Stars */}
              <div className="space-y-1 sm:pr-6 sm:border-r border-border/30">
                <p className="text-2xl sm:text-3xl font-extrabold text-foreground">
                  {ratingSummary.averageRating || 0}
                </p>
                <p className="text-xs text-muted-foreground font-medium">Average Rating</p>
                <div className="flex items-center gap-1.5 pt-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-4 h-4 ${
                        s <= Math.round(ratingSummary.averageRating || 0)
                          ? 'text-amber-500 fill-amber-500'
                          : 'text-zinc-600'
                      }`}
                    />
                  ))}
                  <span className="text-xs text-muted-foreground ml-1">
                    ({ratingSummary.totalRatings || 0} ratings)
                  </span>
                </div>
              </div>

              {/* Right: Message or Status */}
              <div className="flex items-center gap-3 py-2">
                <div className="w-10 h-10 rounded-xl bg-secondary/50 border border-border/40 flex items-center justify-center shrink-0 text-muted-foreground">
                  <Star className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-foreground">
                    {ratingSummary.totalRatings > 0
                      ? 'Ratings collected this week.'
                      : 'No rating data available.'}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                    Ratings from students will appear here.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
