import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Send, Lightbulb } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Suggestion {
  id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
}

export default function Suggestions() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [studentHostel, setStudentHostel] = useState<'Q2' | 'Q2.0' | 'Q2.1' | null>(null);

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
      fetchSuggestions();
      fetchStudentHostel();
    }
  }, [user]);

  const fetchStudentHostel = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('students')
      .select('hostel')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data?.hostel) setStudentHostel(data.hostel as 'Q2' | 'Q2.0' | 'Q2.1');
  };

  const fetchSuggestions = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('suggestions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSuggestions(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !description.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    
    const { error } = await supabase.from('suggestions').insert({
      user_id: user!.id,
      title: title.trim(),
      description: description.trim(),
      status: 'pending',
      hostel: studentHostel
    });

    setIsSubmitting(false);

    if (error) {
      toast.error('Failed to submit suggestion');
    } else {
      toast.success('Suggestion submitted successfully!');
      setTitle('');
      setDescription('');
      fetchSuggestions();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <DashboardLayout title="Suggestions" isAdmin={false}>
      <div className="space-y-6 animate-fade-in">
        {/* Submit Form */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-success" />
              Submit a Suggestion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-foreground">Title</Label>
                <Input
                  id="title"
                  placeholder="Brief title for your suggestion"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-secondary border-border focus:border-primary"
                  maxLength={100}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-foreground">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your suggestion in detail..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-secondary border-border focus:border-primary min-h-[120px]"
                  maxLength={1000}
                  required
                />
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                {isSubmitting ? 'Submitting...' : (
                  <>
                    Submit Suggestion
                    <Send className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Suggestions History */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Your Suggestions</CardTitle>
          </CardHeader>
          <CardContent>
            {suggestions.length > 0 ? (
              <div className="space-y-4">
                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="p-4 rounded-xl bg-secondary"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-foreground font-medium">{suggestion.title}</h4>
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium",
                        suggestion.status === 'implemented' && "bg-success/20 text-success",
                        suggestion.status === 'pending' && "bg-warning/20 text-warning",
                        suggestion.status === 'reviewed' && "bg-info/20 text-info"
                      )}>
                        {suggestion.status.charAt(0).toUpperCase() + suggestion.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{suggestion.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Submitted on {format(new Date(suggestion.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No suggestions submitted yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
