import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useHostel } from '@/contexts/HostelContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CheckCircle, RotateCcw, MessageSquare, Calendar, User } from 'lucide-react';

interface LeaveRequest {
  id: string;
  user_id: string;
  leaving_date: string;
  return_date: string;
  reason: string | null;
  status: string | null;
  admin_message: string | null;
  created_at: string;
  student_name?: string;
  room_no?: string;
}

export default function LeaveRequests() {
  const { user, isAdmin, loading } = useAuth();
  const { selectedHostel } = useHostel();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [adminMessages, setAdminMessages] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate('/admin-login');
    }
  }, [user, isAdmin, loading, navigate]);

  const fetchRequests = useCallback(async () => {
    try {
      const { data: messData, error: messError } = await supabase
        .from('mess_requests')
        .select('*')
        .eq('hostel', selectedHostel)
        .order('created_at', { ascending: false });

      if (messError || !messData) return;

      // Fetch student names for each request
      const userIds = [...new Set(messData.map(r => r.user_id))];
      const { data: students } = await supabase
        .from('students')
        .select('user_id, name, room_no')
        .in('user_id', userIds);

      const studentMap = new Map(students?.map(s => [s.user_id, s]) || []);

      const enriched: LeaveRequest[] = messData.map(r => ({
        ...r,
        student_name: studentMap.get(r.user_id)?.name || 'Unknown',
        room_no: studentMap.get(r.user_id)?.room_no || 'N/A',
      }));

      setRequests(enriched);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
    }
  }, [selectedHostel]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchRequests();
    }
  }, [user, isAdmin, selectedHostel, fetchRequests]);

  useEffect(() => {
    if (!user || !isAdmin) return;

    const channel = supabase
      .channel(`leave-requests-${selectedHostel}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mess_requests' },
        () => fetchRequests()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isAdmin, selectedHostel, fetchRequests]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    const message = adminMessages[id] || null;

    const { error } = await supabase
      .from('mess_requests')
      .update({ status: newStatus, admin_message: message })
      .eq('id', id);

    setUpdatingId(null);

    if (error) {
      toast.error('Failed to update request');
    } else {
      toast.success(`Request marked as ${newStatus}`);
      setAdminMessages(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      fetchRequests();
    }
  };

  const getStatusBadge = (status: string | null) => {
    const s = status || 'pending';
    return (
      <span className={cn(
        "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide",
        s === 'approved' && "bg-green-500/20 text-green-400 border border-green-500/30",
        s === 'pending' && "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
        s === 'returned' && "bg-blue-500/20 text-blue-400 border border-blue-500/30",
        s === 'rejected' && "bg-red-500/20 text-red-400 border border-red-500/30",
      )}>
        {s}
      </span>
    );
  };

  if (loading) {
    return (
      <AdminLayout title="Leave Requests">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AdminLayout>
    );
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;
  const returnedCount = requests.filter(r => r.status === 'returned').length;

  return (
    <AdminLayout title="Leave Requests">
      <div className="space-y-6 animate-fade-in">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-yellow-400">{pendingCount}</p>
              <p className="text-muted-foreground text-sm mt-1">Pending</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-green-400">{approvedCount}</p>
              <p className="text-muted-foreground text-sm mt-1">Approved</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-blue-400">{returnedCount}</p>
              <p className="text-muted-foreground text-sm mt-1">Returned</p>
            </CardContent>
          </Card>
        </div>

        {/* Request List */}
        {requests.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-12 text-center text-muted-foreground">
              No leave requests found
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <Card key={request.id} className="bg-card border-border overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    {/* Student Info */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-primary" />
                          <span className="text-foreground font-semibold">{request.student_name}</span>
                        </div>
                        <span className="text-muted-foreground text-sm">Room: {request.room_no}</span>
                        {getStatusBadge(request.status)}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Leaving: {format(new Date(request.leaving_date), 'MMM d, yyyy')}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Return: {format(new Date(request.return_date), 'MMM d, yyyy')}</span>
                        </div>
                      </div>

                      {request.reason && (
                        <div className="bg-secondary/50 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-1 font-medium">Reason for Leave:</p>
                          <p className="text-sm text-foreground">{request.reason}</p>
                        </div>
                      )}

                      {request.admin_message && (
                        <div className="bg-primary/10 rounded-lg p-3 border border-primary/20">
                          <p className="text-xs text-primary mb-1 font-medium">Admin Message:</p>
                          <p className="text-sm text-foreground">{request.admin_message}</p>
                        </div>
                      )}
                    </div>

                    {/* Admin Actions */}
                    {request.status !== 'returned' && (
                      <div className="flex flex-col gap-2 lg:w-64 shrink-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Message (optional)</span>
                        </div>
                        <Textarea
                          placeholder="Type a message..."
                          value={adminMessages[request.id] || ''}
                          onChange={(e) => setAdminMessages(prev => ({ ...prev, [request.id]: e.target.value }))}
                          className="text-sm min-h-[60px] bg-secondary border-border"
                        />
                        <div className="flex gap-2">
                          {request.status === 'pending' && (
                            <Button
                              size="sm"
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => handleUpdateStatus(request.id, 'approved')}
                              disabled={updatingId === request.id}
                            >
                              <CheckCircle className="w-3.5 h-3.5 mr-1" />
                              Approve
                            </Button>
                          )}
                          {request.status === 'approved' && (
                            <Button
                              size="sm"
                              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                              onClick={() => handleUpdateStatus(request.id, 'returned')}
                              disabled={updatingId === request.id}
                            >
                              <RotateCcw className="w-3.5 h-3.5 mr-1" />
                              Mark Returned
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
