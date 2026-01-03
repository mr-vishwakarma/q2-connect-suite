import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useHostel } from '@/contexts/HostelContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Users, MessageSquare, Lightbulb, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Link } from 'react-router-dom';
import { differenceInDays, parseISO } from 'date-fns';

interface DashboardStats {
  totalStudents: number;
  totalComplaints: number;
  totalSuggestions: number;
}

interface RecentItem {
  id: string;
  title: string;
  description: string;
  created_at: string;
  user_name?: string;
  room_no?: string;
}

interface AlertStudent {
  id: string;
  name: string;
  room_no: string | null;
  fees: number | null;
  valid_date: string | null;
  daysLeft: number | null;
  status: 'expired' | 'expiring' | 'fee_due';
}

function DashboardContent() {
  const { user, isAdmin, loading } = useAuth();
  const { selectedHostel } = useHostel();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({ totalStudents: 0, totalComplaints: 0, totalSuggestions: 0 });
  const [recentComplaints, setRecentComplaints] = useState<RecentItem[]>([]);
  const [recentSuggestions, setRecentSuggestions] = useState<RecentItem[]>([]);
  const [complaintsData, setComplaintsData] = useState<{ name: string; value: number }[]>([]);
  const [alertStudents, setAlertStudents] = useState<AlertStudent[]>([]);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate('/admin-login');
    }
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchStats();
      fetchRecentItems();
      fetchComplaintsChart();
      fetchAlertStudents();
    }
  }, [user, isAdmin, selectedHostel]);

  const fetchStats = async () => {
    try {
      // Get all student user_ids first
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'student');

      const studentUserIds = (roleData || []).map(r => r.user_id);

      // Count only students in selected hostel
      let studentCount = 0;
      if (studentUserIds.length > 0) {
        const { count } = await supabase
          .from('profiles')
          .select('id', { count: 'exact' })
          .eq('hostel', selectedHostel)
          .in('user_id', studentUserIds);
        studentCount = count || 0;
      }

      const [complaintsRes, suggestionsRes] = await Promise.all([
        supabase.from('complaints').select('id', { count: 'exact' }).eq('hostel', selectedHostel),
        supabase.from('suggestions').select('id', { count: 'exact' }).eq('hostel', selectedHostel),
      ]);

      setStats({
        totalStudents: studentCount,
        totalComplaints: complaintsRes.count || 0,
        totalSuggestions: suggestionsRes.count || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchAlertStudents = async () => {
    try {
      // Get all student user_ids
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'student');

      const studentUserIds = (roleData || []).map(r => r.user_id);
      if (studentUserIds.length === 0) {
        setAlertStudents([]);
        return;
      }

      // Get student profiles
      const { data: students } = await supabase
        .from('profiles')
        .select('id, name, room_no, fees, valid_date')
        .eq('hostel', selectedHostel)
        .in('user_id', studentUserIds);

      if (!students) {
        setAlertStudents([]);
        return;
      }

      const today = new Date();
      const alerts: AlertStudent[] = [];

      students.forEach(student => {
        const hasFees = student.fees && student.fees > 0;
        let daysLeft: number | null = null;
        let status: 'expired' | 'expiring' | 'fee_due' | null = null;

        if (student.valid_date) {
          const validDate = parseISO(student.valid_date);
          daysLeft = differenceInDays(validDate, today);

          if (daysLeft < 0) {
            status = 'expired';
          } else if (daysLeft <= 5) {
            status = 'expiring';
          }
        }

        // Include if expired, expiring soon, or has fees remaining
        if (status === 'expired' || status === 'expiring' || hasFees) {
          alerts.push({
            id: student.id,
            name: student.name,
            room_no: student.room_no,
            fees: student.fees,
            valid_date: student.valid_date,
            daysLeft,
            status: status || 'fee_due',
          });
        }
      });

      // Sort: expired first, then by days left
      alerts.sort((a, b) => {
        if (a.status === 'expired' && b.status !== 'expired') return -1;
        if (b.status === 'expired' && a.status !== 'expired') return 1;
        if (a.daysLeft !== null && b.daysLeft !== null) return a.daysLeft - b.daysLeft;
        return 0;
      });

      setAlertStudents(alerts);
    } catch (error) {
      console.error('Error fetching alert students:', error);
    }
  };

  const fetchRecentItems = async () => {
    try {
      const [complaintsRes, suggestionsRes] = await Promise.all([
        supabase
          .from('complaints')
          .select('id, title, description, created_at, user_id')
          .eq('hostel', selectedHostel)
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('suggestions')
          .select('id, title, description, created_at, user_id')
          .eq('hostel', selectedHostel)
          .order('created_at', { ascending: false })
          .limit(3),
      ]);

      setRecentComplaints(complaintsRes.data || []);
      setRecentSuggestions(suggestionsRes.data || []);
    } catch (error) {
      console.error('Error fetching recent items:', error);
    }
  };

  const fetchComplaintsChart = async () => {
    try {
      const { data } = await supabase
        .from('complaints')
        .select('created_at')
        .eq('hostel', selectedHostel)
        .order('created_at', { ascending: true });

      if (data) {
        const chartData = data.reduce((acc: { [key: string]: number }, item) => {
          const date = new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {});

        setComplaintsData(
          Object.entries(chartData).slice(-7).map(([name, value]) => ({ name, value }))
        );
      }
    } catch (error) {
      console.error('Error fetching chart data:', error);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  const statCards = [
    { title: 'Total Students', value: stats.totalStudents, icon: Users, color: 'text-primary', link: '/admin/students' },
    { title: 'Total Complaints', value: stats.totalComplaints, icon: MessageSquare, color: 'text-primary', link: '/admin/complaints' },
    { title: 'Total Suggestions', value: stats.totalSuggestions, icon: Lightbulb, color: 'text-primary', link: '/admin/suggestions' },
  ];

  const getAlertBadge = (student: AlertStudent) => {
    if (student.status === 'expired') {
      return <Badge variant="destructive" className="text-xs">Expired</Badge>;
    }
    if (student.status === 'expiring') {
      return <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-500 border-amber-500/30">{student.daysLeft} days left</Badge>;
    }
    return <Badge variant="secondary" className="text-xs">Fee Due</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-6"
      >
        <h1 className="text-2xl font-bold text-foreground">
          Welcome <span className="text-primary">{user?.email?.split('@')[0] || 'Admin'}!</span>
        </h1>
        <p className="text-muted-foreground">Manager, {selectedHostel} Hostel</p>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Link to={stat.link}>
              <Card className="bg-card border-border hover:border-primary/50 transition-all duration-300 cursor-pointer">
                <CardContent className="p-6 text-center">
                  <p className={`text-4xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-muted-foreground mt-2">{stat.title}</p>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Alerts Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Alerts ({alertStudents.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-64 overflow-y-auto">
            {alertStudents.length > 0 ? (
              alertStudents.map((student) => (
                <div key={student.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{student.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Room: {student.room_no || 'N/A'} • 
                      {student.fees ? ` Fee: ₹${student.fees}` : ''} • 
                      {student.valid_date ? ` Valid till: ${new Date(student.valid_date).toLocaleDateString()}` : ' No validity set'}
                    </p>
                  </div>
                  {getAlertBadge(student)}
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm text-center py-4">No alerts at this time</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts and Recent Items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Complaints */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-card border-border h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground text-lg">New Complaints</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentComplaints.length > 0 ? (
                recentComplaints.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <Clock className="w-4 h-4 text-muted-foreground mt-1" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">No recent complaints</p>
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
          <Card className="bg-card border-border h-full">
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
                        backgroundColor: 'hsl(222 47% 10%)',
                        border: '1px solid hsl(222 47% 18%)',
                        borderRadius: '8px',
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

        {/* Recent Suggestions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="bg-card border-border h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground text-lg">New Suggestions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentSuggestions.length > 0 ? (
                recentSuggestions.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <Clock className="w-4 h-4 text-muted-foreground mt-1" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">No recent suggestions</p>
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

export default function AdminDashboard() {
  return (
    <AdminLayout title="">
      <DashboardContent />
    </AdminLayout>
  );
}
