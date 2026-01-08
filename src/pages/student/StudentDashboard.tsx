import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { UtensilsCrossed, MessageSquare, Lightbulb, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StudentData {
  name: string;
  phone: string | null;
  room_no: string | null;
  valid_date: string | null;
}

export default function StudentDashboard() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [stats, setStats] = useState({
    messRequests: 0,
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

  useEffect(() => {
    if (user) {
      fetchStudentData();
      fetchStats();
    }
  }, [user]);

  const fetchStudentData = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('students')
      .select('name, phone, room_no, valid_date')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (data) {
      setStudentData(data);
    }
  };

  const fetchStats = async () => {
    if (!user) return;

    const [messRes, complaintsRes, suggestionsRes, approvedRes] = await Promise.all([
      supabase.from('mess_requests').select('id', { count: 'exact' }).eq('user_id', user.id),
      supabase.from('complaints').select('id', { count: 'exact' }).eq('user_id', user.id),
      supabase.from('suggestions').select('id', { count: 'exact' }).eq('user_id', user.id),
      supabase.from('mess_requests').select('id', { count: 'exact' }).eq('user_id', user.id).eq('status', 'approved'),
    ]);

    setStats({
      messRequests: messRes.count || 0,
      complaints: complaintsRes.count || 0,
      suggestions: suggestionsRes.count || 0,
      approvedRequests: approvedRes.count || 0
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <DashboardLayout title="Dashboard" isAdmin={false}>
      <div className="space-y-6 animate-fade-in">
        {/* Welcome Section */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Welcome back, {studentData?.name || 'Student'}! 👋
          </h2>
          <p className="text-muted-foreground">
            Here's an overview of your activity in Q2 Management System.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Mess Requests"
            value={stats.messRequests}
            icon={<UtensilsCrossed className="w-6 h-6 text-primary-foreground" />}
          />
          <StatsCard
            title="Approved Requests"
            value={stats.approvedRequests}
            icon={<CheckCircle className="w-6 h-6 text-primary-foreground" />}
          />
          <StatsCard
            title="Complaints"
            value={stats.complaints}
            icon={<MessageSquare className="w-6 h-6 text-primary-foreground" />}
          />
          <StatsCard
            title="Suggestions"
            value={stats.suggestions}
            icon={<Lightbulb className="w-6 h-6 text-primary-foreground" />}
          />
        </div>

        {/* Quick Info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Your Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="text-foreground font-medium">{studentData?.name || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Room No</span>
                <span className="text-foreground font-medium">{studentData?.room_no || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone</span>
                <span className="text-foreground font-medium">{studentData?.phone || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valid Until</span>
                <span className="text-foreground font-medium">
                  {studentData?.valid_date ? new Date(studentData.valid_date).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate('/student/mess-off')}
                className="p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors text-left"
              >
                <UtensilsCrossed className="w-6 h-6 text-primary mb-2" />
                <p className="text-sm font-medium text-foreground">Request Mess Off</p>
              </button>
              <button
                onClick={() => navigate('/student/complaints')}
                className="p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors text-left"
              >
                <MessageSquare className="w-6 h-6 text-warning mb-2" />
                <p className="text-sm font-medium text-foreground">File Complaint</p>
              </button>
              <button
                onClick={() => navigate('/student/suggestions')}
                className="p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors text-left col-span-2"
              >
                <Lightbulb className="w-6 h-6 text-success mb-2" />
                <p className="text-sm font-medium text-foreground">Submit Suggestion</p>
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
