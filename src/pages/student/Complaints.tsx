import { InlineSkeletonList } from '@/components/ui/dashboard-skeleton';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Send, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Complaint {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
}

export default function Complaints() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
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
      fetchComplaints();
      fetchStudentHostel();
    }
  }, [user]);

  const fetchStudentHostel = async () => {
    try {
      const response = await api.get('/students/me');
      if (response.data?.success) {
        setStudentHostel(response.data.data.hostel);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchComplaints = async () => {
    try {
      const response = await api.get('/complaints');
      if (response.data?.success) {
        setComplaints(response.data.data.map((c: any) => ({
          id: c._id,
          title: c.title,
          description: c.description,
          status: c.status,
          createdAt: c.createdAt,
        })));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !description.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      await api.post('/complaints', {
        title: title.trim(),
        description: description.trim(),
        hostel: studentHostel
      });
      toast.success('Complaint submitted successfully!');
      setTitle('');
      setDescription('');
      fetchComplaints();
    } catch (error) {
      toast.error('Failed to submit complaint');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="py-8"><InlineSkeletonList rows={5} /></div>
      </div>
    );
  }

  return (
    <DashboardLayout title="Complaints" isAdmin={false}>
      <div className="space-y-6 animate-fade-in">
        {/* Submit Form */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-warning" />
              Submit a Complaint
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-foreground">Title</Label>
                <Input
                  id="title"
                  placeholder="Brief title for your complaint"
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
                  placeholder="Describe your complaint in detail..."
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
                    Submit Complaint
                    <Send className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Complaints History */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Your Complaints</CardTitle>
          </CardHeader>
          <CardContent>
            {complaints.length > 0 ? (
              <div className="space-y-4">
                {complaints.map((complaint) => (
                  <div
                    key={complaint.id}
                    className="p-4 rounded-xl bg-secondary"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-foreground font-medium">{complaint.title}</h4>
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium",
                        complaint.status === 'resolved' && "bg-success/20 text-success",
                        complaint.status === 'pending' && "bg-warning/20 text-warning",
                        complaint.status === 'in_progress' && "bg-info/20 text-info"
                      )}>
                        {complaint.status === 'in_progress' ? 'In Progress' : 
                          complaint.status.charAt(0).toUpperCase() + complaint.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{complaint.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Submitted on {format(new Date(complaint.createdAt), 'MMM d, yyyy')}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No complaints submitted yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
