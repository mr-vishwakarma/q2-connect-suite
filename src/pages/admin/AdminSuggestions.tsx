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
import { Lightbulb, CheckCircle, Clock, XCircle } from 'lucide-react';

interface Suggestion {
  id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  user_id: string;
}

function AdminSuggestionsContent() {
  const { user, isAdmin, loading } = useAuth();
  const { selectedHostel } = useHostel();
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate('/admin-login');
    }
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchSuggestions();
    }
  }, [user, isAdmin, selectedHostel]);

  const fetchSuggestions = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('suggestions')
        .select('*')
        .eq('hostel', selectedHostel)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSuggestions(data || []);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      toast.error('Failed to fetch suggestions');
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('suggestions')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Suggestion marked as ${status}`);
      fetchSuggestions();
    } catch (error) {
      console.error('Error updating suggestion:', error);
      toast.error('Failed to update suggestion');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'implemented':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Implemented</Badge>;
      case 'under_review':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Under Review</Badge>;
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">
          All Suggestions - {selectedHostel}
        </h2>
        <Badge variant="outline" className="text-primary border-primary w-fit">
          {suggestions.length} Total
        </Badge>
      </div>

      <div className="space-y-3 sm:space-y-4">
        {suggestions.length > 0 ? (
          suggestions.map((suggestion, index) => (
            <motion.div
              key={suggestion.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="bg-card border-border hover:border-primary/30 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                        <Lightbulb className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-foreground text-lg">{suggestion.title}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {new Date(suggestion.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(suggestion.status || 'pending')}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">{suggestion.description}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus(suggestion.id, 'under_review')}
                      className="text-yellow-400 border-yellow-400/30 hover:bg-yellow-400/10"
                    >
                      <Clock className="w-4 h-4 mr-1" />
                      Under Review
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus(suggestion.id, 'implemented')}
                      className="text-green-400 border-green-400/30 hover:bg-green-400/10"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Implemented
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus(suggestion.id, 'rejected')}
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
              <Lightbulb className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No suggestions found for {selectedHostel}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function AdminSuggestions() {
  return (
    <AdminLayout title="Suggestions">
      <AdminSuggestionsContent />
    </AdminLayout>
  );
}
