import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useHostel } from '@/contexts/HostelContext';
import { dashboardService } from '@/services/api';
import { useQuery } from '@tanstack/react-query';
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
import { WidgetErrorBoundary } from '@/components/common/WidgetErrorBoundary';

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
  room_no?: string;
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

  const { data: dashboardData } = useQuery({
    queryKey: ['adminDashboard', selectedHostel],
    queryFn: async () => {
      const response = await dashboardService.getAdminDashboard({ hostel: selectedHostel });
      return response.data;
    },
    staleTime: 60 * 1000,
    enabled: !!(user && isAdmin),
  });

  const dashboardDerived = useMemo(() => {
    const stats: DashboardStats = dashboardData?.stats || {
      totalStudents: 0,
      totalComplaints: 0,
      totalSuggestions: 0,
      studentsTrend: '+0%',
      complaintsTrend: '+0%',
      suggestionsTrend: '+0%',
    };
    const complaintsSummary = dashboardData?.complaintsSummary || { today: 0, thisWeek: 0, thisMonth: 0 };
    const recentComplaints: RecentComplaint[] = dashboardData?.recentComplaints || [];
    const recentSuggestions: RecentSuggestion[] = dashboardData?.recentSuggestions || [];
    const complaintsData = dashboardData?.complaintsData || [];
    const allocation = dashboardData?.allocationDistribution || {
      total: stats.totalStudents || 0,
      allocated: stats.totalStudents || 0,
      pending: 0,
      vacant: 0,
    };
    const ratingSummary = dashboardData?.ratingSummary || { averageRating: 0, totalRatings: 0 };
    const totalAllocCapacity = (allocation.allocated + allocation.pending + allocation.vacant) || (stats.totalStudents || 1);
    const allocatedPct = totalAllocCapacity > 0 ? Math.round((allocation.allocated / totalAllocCapacity) * 100) : 0;
    const pendingPct = totalAllocCapacity > 0 ? Math.round((allocation.pending / totalAllocCapacity) * 100) : 0;
    const vacantPct = totalAllocCapacity > 0 ? Math.round((allocation.vacant / totalAllocCapacity) * 100) : 0;
    const donutData = [
      { name: 'Allocated', value: allocation.allocated || (stats.totalStudents ? stats.totalStudents : 1), color: '#A78BFA' },
      { name: 'Pending', value: allocation.pending || 0, color: '#ED91C1' },
      { name: 'Vacant', value: allocation.vacant || 0, color: '#3E435D' },
    ];
    return { stats, complaintsSummary, recentComplaints, recentSuggestions, complaintsData, allocation, ratingSummary, totalAllocCapacity, allocatedPct, pendingPct, vacantPct, donutData };
  }, [dashboardData]);

  const { stats, complaintsSummary, recentComplaints, recentSuggestions, complaintsData, allocation, ratingSummary, totalAllocCapacity, allocatedPct, pendingPct, vacantPct, donutData } = dashboardDerived;

  // Manager display name — recomputes only when profile/user changes
  const managerName = useMemo(
    () => profile?.name || user?.email?.split('@')[0] || 'Manager',
    [profile?.name, user?.email]
  );

  // Category Icon helper — stable function reference
  const getCategoryIcon = useCallback((category?: string) => {
    const cat = (category || 'Room').toLowerCase();
    if (cat.includes('water')) return <Droplets className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400" />;
    if (cat.includes('wifi')) return <Wifi className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />;
    if (cat.includes('elec')) return <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />;
    if (cat.includes('clean')) return <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />;
    if (cat.includes('mess') || cat.includes('food')) return <Utensils className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" />;
    return <Home className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400" />;
  }, []);

  return (
    <div className="space-y-4 md:space-y-5 pb-8 max-w-7xl mx-auto">
      {/* 1. HERO BANNER */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card-highlight relative overflow-hidden rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl"
      >
        {/* Ambient Lavender & Indigo Glow Aura */}
        <div className="pointer-events-none absolute -top-10 -left-10 w-52 sm:w-68 h-52 sm:h-68 rounded-full bg-[#A78BFA]/18 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 right-8 w-52 sm:w-68 h-52 sm:h-68 rounded-full bg-[#74DCCB]/12 blur-3xl" />

        <div className="relative z-10 flex items-center justify-between gap-3 sm:gap-5">
          {/* Left Text & Action */}
          <div className="flex-1 min-w-0 pr-1 sm:pr-4">
            <h1 className="text-lg sm:text-xl md:text-2xl font-semibold text-[#F0EFF8] tracking-tight leading-snug">
              Welcome back, <span className="text-[#A78BFA]">{managerName}</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#9295AD] mt-1 truncate">
              Manager &bull; {selectedHostel || 'Hosteliq'} Hostel
            </p>
            <p className="text-[11px] sm:text-xs text-[#74788F] mt-1 line-clamp-2 sm:line-clamp-none">
              Monitor occupancy, collections, complaints, and resident requests from your unified glass console.
            </p>
            <div className="mt-3 sm:mt-4">
              <Button asChild className="gap-1.5 text-xs sm:text-sm">
                <Link to="/admin/leave-requests">
                  <ListChecks className="w-4 h-4 shrink-0" />
                  <span>View Leave Records</span>
                </Link>
              </Button>
            </div>
          </div>

          {/* Right Text & 3D Building artwork */}
          <div className="flex flex-col items-end shrink-0 pl-1">
            <div className="text-right mb-1 sm:mb-2 hidden xs:block sm:block">
              <p className="text-[9px] sm:text-[10px] md:text-xs text-[#9295AD] uppercase tracking-wider font-medium">Manage Today</p>
              <p className="text-[11px] sm:text-xs md:text-sm font-semibold text-[#F0EFF8] leading-tight">For a Better</p>
              <p className="text-[11px] sm:text-xs md:text-sm font-semibold text-[#F0EFF8] leading-tight">Tomorrow</p>
              <div className="w-7 h-[2px] bg-gradient-to-r from-[#ED91C1] to-[#A78BFA] ml-auto mt-1 rounded-full" />
            </div>

            <div className="relative flex items-center justify-center w-24 h-20 sm:w-36 sm:h-32 md:w-44 md:h-36">
              {/* Central ambient lavender/mint aura */}
              <div
                className="absolute inset-0 m-auto w-20 h-20 sm:w-32 sm:h-32 rounded-full pointer-events-none"
                style={{
                  background: 'radial-gradient(circle, rgba(167, 139, 250, 0.36) 0%, rgba(116, 220, 203, 0.14) 52%, transparent 78%)',
                  filter: 'blur(10px)',
                }}
              />
              <img
                src="/assets/hostel-3d-building.png"
                alt="Hostel 3D View"
                width={176}
                height={144}
                decoding="async"
                className="relative z-10 w-full h-full object-contain drop-shadow-[0_12px_22px_rgba(4,5,12,0.75)]"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* 2. 3 METRIC STAT CARDS ROW */}
      <WidgetErrorBoundary title="Dashboard Metrics">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        {/* Card 1: Total Students */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          onClick={() => navigate('/admin/students')}
          className="cursor-pointer group glass-card-highlight rounded-2xl p-4 hover:border-white/[0.16] transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-[#A78BFA]/12 border border-[#A78BFA]/25 flex items-center justify-center text-[#A78BFA]">
              <Users className="w-4 h-4" />
            </div>
            <ChevronRight className="w-4 h-4 text-[#74788F] group-hover:text-foreground transition-colors" />
          </div>
          <p className="text-xs text-[#9295AD] font-medium">Total Students</p>
          <p className="text-xl md:text-2xl font-semibold text-[#F0EFF8] tabular-nums mt-0.5">
            {stats.totalStudents}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-[#74DCCB]">
              ↑ {stats.studentsTrend || '+0%'}
            </span>
            <span className="text-[11px] text-[#74788F]">from last month</span>
          </div>
        </motion.div>

        {/* Card 2: Total Complaints */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          onClick={() => navigate('/admin/complaints')}
          className="cursor-pointer group glass-card-highlight rounded-2xl p-4 hover:border-white/[0.16] transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-[#ED91C1]/12 border border-[#ED91C1]/25 flex items-center justify-center text-[#ED91C1]">
              <MessageSquare className="w-4 h-4" />
            </div>
            <ChevronRight className="w-4 h-4 text-[#74788F] group-hover:text-foreground transition-colors" />
          </div>
          <p className="text-xs text-[#9295AD] font-medium">Total Complaints</p>
          <p className="text-xl md:text-2xl font-semibold text-[#F0EFF8] tabular-nums mt-0.5">
            {stats.totalComplaints}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-[#ED91C1]">
              {stats.complaintsTrend || '0%'}
            </span>
            <span className="text-[11px] text-[#74788F]">from last month</span>
          </div>
        </motion.div>

        {/* Card 3: Total Suggestions */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          onClick={() => navigate('/admin/suggestions')}
          className="cursor-pointer group glass-card-highlight rounded-2xl p-4 hover:border-white/[0.16] transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-[#74DCCB]/12 border border-[#74DCCB]/25 flex items-center justify-center text-[#74DCCB]">
              <Lightbulb className="w-4 h-4" />
            </div>
            <ChevronRight className="w-4 h-4 text-[#74788F] group-hover:text-foreground transition-colors" />
          </div>
          <p className="text-xs text-[#9295AD] font-medium">Total Suggestions</p>
          <p className="text-xl md:text-2xl font-semibold text-[#F0EFF8] tabular-nums mt-0.5">
            {stats.totalSuggestions}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-[#9295AD]">
              {stats.suggestionsTrend || '+0%'}
            </span>
            <span className="text-[11px] text-[#74788F]">from last month</span>
          </div>
        </motion.div>
      </div>
      </WidgetErrorBoundary>

      {/* 3. ROW 2: NEW COMPLAINTS + DAILY COMPLAINTS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        {/* NEW COMPLAINTS CARD */}
        <WidgetErrorBoundary title="New Complaints">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="h-full flex flex-col"
        >
          <Card className="rounded-2xl flex flex-col h-full overflow-hidden">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[#ED91C1]/12 border border-[#ED91C1]/25 flex items-center justify-center text-[#ED91C1] shrink-0">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <CardTitle className="text-sm md:text-base font-semibold text-[#F0EFF8] truncate">
                  New Complaints
                </CardTitle>
              </div>
              <Link
                to="/admin/complaints"
                className="text-xs text-[#9295AD] hover:text-foreground flex items-center gap-0.5 font-medium transition-colors shrink-0"
              >
                <span>View All</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </CardHeader>

            <CardContent className="p-4 pt-1 flex-1 flex flex-col justify-between space-y-2.5">
              <div className="space-y-2 flex-1 overflow-y-auto max-h-[156px]">
                {recentComplaints.length > 0 ? (
                  recentComplaints.map((item) => (
                    <div
                      key={item._id}
                      onClick={() => navigate('/admin/complaints')}
                      className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#F0EFF8] truncate">
                          {item.title}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#ED91C1]/12 text-[#ED91C1] font-medium shrink-0">
                          {item.category || 'General'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#9295AD] mt-1">
                        <span>Room {item.room_no || 'N/A'}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-[#9295AD]">
                          {item.tag || item.category || 'Room'}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-[#74788F] text-xs">
                    <p>No recent complaints logged.</p>
                  </div>
                )}
              </div>

              <Link
                to="/admin/complaints"
                className="w-full mt-auto py-2 px-3 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] rounded-xl text-xs font-medium flex items-center justify-between transition-colors text-[#F0EFF8]"
              >
                <span className="truncate">Manage Complaints</span>
                <ChevronRight className="w-3.5 h-3.5 text-[#9295AD] shrink-0" />
              </Link>
            </CardContent>
          </Card>
        </motion.div>
        </WidgetErrorBoundary>

        {/* DAILY COMPLAINTS CHART CARD */}
        <WidgetErrorBoundary title="Daily Complaints Chart">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="h-full flex flex-col"
        >
          <Card className="rounded-2xl flex flex-col h-full overflow-hidden">
            <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[#A78BFA]/12 border border-[#A78BFA]/25 flex items-center justify-center text-[#A78BFA] shrink-0">
                  <BarChart2 className="w-3.5 h-3.5" />
                </div>
                <CardTitle className="text-sm md:text-base font-semibold text-[#F0EFF8] truncate">
                  Daily Complaints
                </CardTitle>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-[#9295AD] bg-white/[0.04] border border-white/[0.07] px-2 py-0.5 rounded-lg shrink-0">
                <span>Last 7 Days</span>
                <ChevronDown className="w-3 h-3" />
              </div>
            </CardHeader>

            <CardContent className="p-4 pt-1 flex-1 flex flex-col justify-between">
              <div className="h-[130px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={complaintsData} margin={{ top: 5, right: 6, left: -28, bottom: 0 }}>
                    <defs>
                      <linearGradient id="complaintLavenderGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#A78BFA" stopOpacity={0.38} />
                        <stop offset="92%" stopColor="#A78BFA" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="name"
                      stroke="#74788F"
                      fontSize={10}
                      tickLine={false}
                      axisLine={{ stroke: 'rgba(225,225,255,0.08)' }}
                    />
                    <YAxis
                      stroke="#74788F"
                      fontSize={10}
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#171928',
                        border: '1px solid rgba(167,139,250,0.28)',
                        borderRadius: '10px',
                        color: '#F0EFF8',
                        fontSize: '11px',
                        boxShadow: '0 8px 24px rgba(5,6,12,0.65)',
                        padding: '6px 10px',
                      }}
                      itemStyle={{ color: '#A78BFA' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#A78BFA"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#complaintLavenderGlow)"
                      dot={{ r: 2.5, fill: '#A78BFA', stroke: '#8B6EF3', strokeWidth: 1 }}
                      activeDot={{ r: 4.5, fill: '#F0EFF8', stroke: '#A78BFA', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3 pt-2 border-t border-white/[0.06]">
                <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl py-1.5 px-1 text-center">
                  <p className="text-sm font-semibold text-[#F0EFF8] tabular-nums leading-tight">
                    {complaintsSummary.today}
                  </p>
                  <p className="text-[10px] text-[#74788F] mt-0.5">Today</p>
                </div>
                <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl py-1.5 px-1 text-center">
                  <p className="text-sm font-semibold text-[#F0EFF8] tabular-nums leading-tight">
                    {complaintsSummary.thisWeek}
                  </p>
                  <p className="text-[10px] text-[#74788F] mt-0.5 truncate">This Week</p>
                </div>
                <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl py-1.5 px-1 text-center">
                  <p className="text-sm font-semibold text-[#F0EFF8] tabular-nums leading-tight">
                    {complaintsSummary.thisMonth}
                  </p>
                  <p className="text-[10px] text-[#74788F] mt-0.5 truncate">This Month</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        </WidgetErrorBoundary>
      </div>

      {/* 4. ROW 3: DISTRIBUTION + NEW SUGGESTIONS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        {/* DISTRIBUTION CARD */}
        <WidgetErrorBoundary title="Student Distribution">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="h-full flex flex-col"
        >
          <Card className="rounded-2xl flex flex-col h-full overflow-hidden">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[#A78BFA]/12 border border-[#A78BFA]/25 flex items-center justify-center text-[#A78BFA] shrink-0">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <CardTitle className="text-sm md:text-base font-semibold text-[#F0EFF8] truncate">
                  Distribution
                </CardTitle>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-[#9295AD] bg-white/[0.04] border border-white/[0.07] px-2 py-0.5 rounded-lg shrink-0">
                <span>Students</span>
                <ChevronDown className="w-3 h-3" />
              </div>
            </CardHeader>

            <CardContent className="p-4 pt-1 flex-1 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-[125px] h-[125px] shrink-0 flex items-center justify-center mx-auto sm:mx-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={36}
                      outerRadius={52}
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
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-base font-semibold text-[#F0EFF8] leading-tight tabular-nums">
                    {allocation.total || stats.totalStudents}
                  </span>
                  <span className="text-[10px] text-[#74788F] font-medium">Total</span>
                </div>
              </div>

              <div className="w-full sm:flex-1 space-y-2 sm:pr-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#A78BFA] shrink-0" />
                    <span className="text-[#9295AD]">Allocated</span>
                  </div>
                  <span className="font-semibold text-[#F0EFF8] tabular-nums">
                    {allocation.allocated} ({allocatedPct}%)
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ED91C1] shrink-0" />
                    <span className="text-[#9295AD]">Pending</span>
                  </div>
                  <span className="font-semibold text-[#F0EFF8] tabular-nums">
                    {allocation.pending} ({pendingPct}%)
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#3E435D] shrink-0" />
                    <span className="text-[#9295AD]">Vacant</span>
                  </div>
                  <span className="font-semibold text-[#F0EFF8] tabular-nums">
                    {allocation.vacant} ({vacantPct}%)
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        </WidgetErrorBoundary>

        {/* NEW SUGGESTIONS CARD */}
        <WidgetErrorBoundary title="New Suggestions">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
          className="h-full flex flex-col"
        >
          <Card className="rounded-2xl flex flex-col h-full overflow-hidden">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[#74DCCB]/12 border border-[#74DCCB]/25 flex items-center justify-center text-[#74DCCB] shrink-0">
                  <Lightbulb className="w-3.5 h-3.5" />
                </div>
                <CardTitle className="text-sm md:text-base font-semibold text-[#F0EFF8] truncate">
                  New Suggestions
                </CardTitle>
              </div>
              <Link
                to="/admin/suggestions"
                className="text-xs text-[#9295AD] hover:text-foreground flex items-center gap-0.5 font-medium transition-colors shrink-0"
              >
                <span>View All</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </CardHeader>

            <CardContent className="p-4 pt-1 flex-1 flex flex-col justify-between space-y-2.5">
              {recentSuggestions.length > 0 ? (
                <div className="space-y-2 flex-1 overflow-y-auto max-h-[156px]">
                  {recentSuggestions.map((item) => (
                    <div
                      key={item._id}
                      onClick={() => navigate('/admin/suggestions')}
                      className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all cursor-pointer"
                    >
                      <p className="text-xs font-semibold text-[#F0EFF8] truncate">{item.title}</p>
                      <p className="text-[11px] text-[#9295AD] line-clamp-1 mt-0.5">{item.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-[#74788F] mb-2">
                    <MessageSquareDiff className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-[#F0EFF8]">No recent suggestions</p>
                  <p className="text-[11px] text-[#74788F] mt-0.5">
                    Suggestions from students will appear here.
                  </p>
                </div>
              )}

              <Link
                to="/admin/suggestions"
                className="w-full mt-auto py-2 px-3 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] rounded-xl text-xs font-medium flex items-center justify-between transition-colors text-[#F0EFF8]"
              >
                <span className="truncate">Manage Suggestions</span>
                <ChevronRight className="w-3.5 h-3.5 text-[#9295AD] shrink-0" />
              </Link>
            </CardContent>
          </Card>
        </motion.div>
        </WidgetErrorBoundary>
      </div>

      {/* 5. ROW 4: MENU RATINGS OVERVIEW CARD */}
      <WidgetErrorBoundary title="Menu Ratings Overview">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.36 }}
      >
        <Card className="rounded-2xl">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 fill-amber-400 shrink-0" />
              <CardTitle className="text-sm md:text-base font-semibold text-[#F0EFF8]">
                Menu Ratings Overview
              </CardTitle>
            </div>
            <Link
              to="/admin/analytics"
              className="text-xs text-[#9295AD] hover:text-foreground flex items-center gap-0.5 font-medium transition-colors"
            >
              <span>View Details</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </CardHeader>

          <CardContent className="p-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div className="space-y-1 sm:pr-4 sm:border-r border-white/[0.07]">
                <p className="text-2xl md:text-3xl font-semibold text-[#F0EFF8] tabular-nums">
                  {ratingSummary.averageRating || 0}
                </p>
                <p className="text-xs text-[#9295AD] font-medium">Average Rating</p>
                <div className="flex items-center gap-1 pt-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-4 h-4 ${
                        s <= Math.round(ratingSummary.averageRating || 0)
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-[#3E435D]'
                      }`}
                    />
                  ))}
                  <span className="text-xs text-[#9295AD] ml-1">
                    ({ratingSummary.totalRatings || 0} ratings)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 py-1">
                <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center shrink-0 text-[#9295AD]">
                  <Star className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#F0EFF8]">
                    {ratingSummary.totalRatings > 0
                      ? 'Ratings collected this week.'
                      : 'No rating data available.'}
                  </p>
                  <p className="text-xs text-[#74788F] mt-0.5">
                    Ratings from students will appear here.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
      </WidgetErrorBoundary>
    </div>
  );
}
