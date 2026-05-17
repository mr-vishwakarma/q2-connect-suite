import { useCallback, useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useHostel } from '@/contexts/HostelContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  CheckCircle, RotateCcw, MessageSquare, Calendar, User, Search,
  FileText, Phone, Home, Eye, ListChecks
} from 'lucide-react';

interface LeaveRequest {
  id: string;
  user_id: string;
  leaving_date: string;
  return_date: string;
  reason: string | null;
  status: string | null;
  admin_message: string | null;
  created_at: string;
  hostel: string | null;
  document_url: string | null;
  document_name: string | null;
  parent_mobile: string | null;
  approved_date: string | null;
  student_name?: string;
  room_no?: string;
  username?: string;
  student_parent_phone?: string | null;
}

export default function LeaveRequests() {
  const { user, isAdmin, loading } = useAuth();
  const { selectedHostel } = useHostel();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [adminMessages, setAdminMessages] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [recordsOpen, setRecordsOpen] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate('/admin-login');
  }, [user, isAdmin, loading, navigate]);

  const fetchRequests = useCallback(async () => {
    try {
      const { data: messData, error } = await supabase
        .from('mess_requests')
        .select('*')
        .eq('hostel', selectedHostel)
        .order('created_at', { ascending: false });

      if (error || !messData) return;

      const userIds = [...new Set(messData.map(r => r.user_id))];
      const { data: students } = await supabase
        .from('students')
        .select('user_id, name, room_no, username, parent_phone')
        .in('user_id', userIds);

      const studentMap = new Map(students?.map(s => [s.user_id, s]) || []);

      const enriched: LeaveRequest[] = messData.map(r => ({
        ...r,
        student_name: studentMap.get(r.user_id)?.name || 'Unknown',
        room_no: studentMap.get(r.user_id)?.room_no || 'N/A',
        username: studentMap.get(r.user_id)?.username,
        student_parent_phone: studentMap.get(r.user_id)?.parent_phone || null,
      }));

      setRequests(enriched);
    } catch (e) {
      console.error('Error fetching leave requests:', e);
    }
  }, [selectedHostel]);

  useEffect(() => {
    if (user && isAdmin) fetchRequests();
  }, [user, isAdmin, selectedHostel, fetchRequests]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    const channel = supabase
      .channel(`leave-requests-${selectedHostel}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mess_requests' }, () => fetchRequests())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, isAdmin, selectedHostel, fetchRequests]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    const message = adminMessages[id] || null;
    const payload: Record<string, unknown> = { status: newStatus, admin_message: message };
    if (newStatus === 'approved') payload.approved_date = new Date().toISOString();

    const { error } = await supabase.from('mess_requests').update(payload).eq('id', id);
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

  const viewDocument = async (path: string) => {
    const { data, error } = await supabase.storage
      .from('leave-documents')
      .createSignedUrl(path, 60 * 10);
    if (error || !data) {
      toast.error('Could not open document');
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  const downloadDocument = async (path: string, name?: string | null) => {
    const { data, error } = await supabase.storage
      .from('leave-documents')
      .download(path);
    if (error || !data) {
      toast.error('Could not download document');
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = name || path.split('/').pop() || 'leave-document';
    a.click();
    URL.revokeObjectURL(url);
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
      )}>{s}</span>
    );
  };

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter(r =>
      (r.student_name || '').toLowerCase().includes(q) ||
      (r.username || '').toLowerCase().includes(q) ||
      (r.user_id || '').toLowerCase().includes(q)
    );
  }, [requests, search]);

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
        {/* Top actions */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by student name or User ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-secondary border-border"
            />
          </div>
          <Button onClick={() => setRecordsOpen(true)} className="gap-2">
            <ListChecks className="w-4 h-4" />
            View Hostel Leave Records
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
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
        {filteredRequests.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-12 text-center text-muted-foreground">
              {search ? `No leave requests match "${search}"` : 'No leave requests found'}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((request) => (
              <Card key={request.id} className="bg-card border-border overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-primary" />
                          <span className="text-foreground font-semibold">{request.student_name}</span>
                        </div>
                        <span className="text-muted-foreground text-sm flex items-center gap-1">
                          <Home className="w-3.5 h-3.5" /> Room {request.room_no}
                        </span>
                        <span className="text-muted-foreground text-sm">Hostel: {request.hostel}</span>
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
                        {request.approved_date && (
                          <div className="flex items-center gap-1.5 text-green-400">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Approved: {format(new Date(request.approved_date), 'MMM d, yyyy')}</span>
                          </div>
                        )}
                        {(request.parent_mobile || request.student_parent_phone) && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5" />
                            <span>Parent: {request.parent_mobile || request.student_parent_phone}</span>
                          </div>
                        )}
                      </div>

                      {request.reason && (
                        <div className="bg-secondary/50 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-1 font-medium">Reason for Leave:</p>
                          <p className="text-sm text-foreground">{request.reason}</p>
                        </div>
                      )}

                      {request.document_url && (
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" className="gap-2" onClick={() => viewDocument(request.document_url!)}>
                            <Eye className="w-3.5 h-3.5" /> View Document
                          </Button>
                          <Button size="sm" variant="outline" className="gap-2" onClick={() => downloadDocument(request.document_url!, request.document_name)}>
                            <FileText className="w-3.5 h-3.5" /> Download
                          </Button>
                          {request.document_name && (
                            <span className="text-xs text-muted-foreground self-center">{request.document_name}</span>
                          )}
                        </div>
                      )}

                      {request.admin_message && (
                        <div className="bg-primary/10 rounded-lg p-3 border border-primary/20">
                          <p className="text-xs text-primary mb-1 font-medium">Admin Message:</p>
                          <p className="text-sm text-foreground">{request.admin_message}</p>
                        </div>
                      )}
                    </div>

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
                              <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                            </Button>
                          )}
                          {request.status === 'approved' && (
                            <Button
                              size="sm"
                              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                              onClick={() => handleUpdateStatus(request.id, 'returned')}
                              disabled={updatingId === request.id}
                            >
                              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Mark Returned
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

        {/* All Hostel Leave Records Modal */}
        <Dialog open={recordsOpen} onOpenChange={setRecordsOpen}>
          <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-primary" />
                All Hostel Leave Records — {selectedHostel}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {requests.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No leave records found</p>
              ) : (
                requests.map((r) => (
                  <div key={r.id} className="p-4 rounded-xl bg-secondary border border-border space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-semibold text-foreground">{r.student_name}</span>
                      <span className="text-xs text-muted-foreground">Room {r.room_no}</span>
                      <span className="text-xs text-muted-foreground">Hostel: {r.hostel}</span>
                      {getStatusBadge(r.status)}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <span>Leaving: {format(new Date(r.leaving_date), 'MMM d, yyyy')}</span>
                      <span>Return: {format(new Date(r.return_date), 'MMM d, yyyy')}</span>
                      <span>Approved: {r.approved_date ? format(new Date(r.approved_date), 'MMM d, yyyy') : '—'}</span>
                      <span>Parent: {r.parent_mobile || r.student_parent_phone || '—'}</span>
                    </div>
                    {r.reason && <p className="text-sm text-foreground"><span className="text-muted-foreground">Reason:</span> {r.reason}</p>}
                    {r.document_url && (
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" variant="outline" className="gap-2" onClick={() => viewDocument(r.document_url!)}>
                          <Eye className="w-3.5 h-3.5" /> View
                        </Button>
                        <Button size="sm" variant="outline" className="gap-2" onClick={() => downloadDocument(r.document_url!, r.document_name)}>
                          <FileText className="w-3.5 h-3.5" /> Download
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
