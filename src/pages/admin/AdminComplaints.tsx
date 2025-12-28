import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useHostel } from '@/contexts/HostelContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { MessageSquare, CheckCircle, Clock, XCircle } from 'lucide-react';

interface Complaint {
  id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  user_id: string;
}

function AdminComplaintsContent() {
  const { user, isAdmin, loading } = useAuth();
  const { selectedHostel } = useHostel();
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate('/admin-login');
    }
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchComplaints();
    }
  }, [user, isAdmin, selectedHostel]);

  const fetchComplaints = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .eq('hostel', selectedHostel)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComplaints(data || []);
    } catch (error) {
      console.error('Error fetching complaints:', error);
      toast.error('Failed to fetch complaints');
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('complaints')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Complaint marked as ${status}`);
      fetchComplaints();
    } catch (error) {
      console.error('Error updating complaint:', error);
      toast.error('Failed to update complaint');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Resolved</Badge>;
      case 'in_progress':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">In Progress</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Rejected</Badge>;
      default:
        return <Badge className="bg-primary/20 text-primary border-primary/30">Pending</Badge>;
    }
  };

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">
          All Complaints - {selectedHostel}
        </h2>
        <Badge variant="outline" className="text-primary border-primary">
          {complaints.length} Total
        </Badge>
      </div>

      <div className="space-y-4">
        {complaints.length > 0 ? (
          complaints.map((complaint, index) => (
            <motion.div
              key={complaint.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="bg-card border-border hover:border-primary/30 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-foreground text-lg">{complaint.title}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {new Date(complaint.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(complaint.status || 'pending')}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">{complaint.description}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus(complaint.id, 'in_progress')}
                      className="text-yellow-400 border-yellow-400/30 hover:bg-yellow-400/10"
                    >
                      <Clock className="w-4 h-4 mr-1" />
                      In Progress
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus(complaint.id, 'resolved')}
                      className="text-green-400 border-green-400/30 hover:bg-green-400/10"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Resolved
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus(complaint.id, 'rejected')}
                      className="text-red-400 border-red-400/30 hover:bg-red-400/10"
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        ) : (
          <Card className="bg-card border-border">
            <CardContent className="py-12 text-center">
              <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No complaints found for {selectedHostel}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function AdminComplaints() {
  return (
    <AdminLayout title="Complaints">
      <AdminComplaintsContent />
    </AdminLayout>
  );
}
