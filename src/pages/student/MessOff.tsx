import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Calendar, Send } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface MessRequest {
  id: string;
  leaving_date: string;
  return_date: string;
  status: string;
  created_at: string;
}

export default function MessOff() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [leavingDate, setLeavingDate] = useState<Date>();
  const [returnDate, setReturnDate] = useState<Date>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requests, setRequests] = useState<MessRequest[]>([]);

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
      fetchRequests();
    }
  }, [user]);

  const fetchRequests = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('mess_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRequests(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!leavingDate || !returnDate) {
      toast.error('Please select both dates');
      return;
    }

    if (returnDate <= leavingDate) {
      toast.error('Return date must be after leaving date');
      return;
    }

    setIsSubmitting(true);
    
    const { error } = await supabase.from('mess_requests').insert({
      user_id: user!.id,
      leaving_date: format(leavingDate, 'yyyy-MM-dd'),
      return_date: format(returnDate, 'yyyy-MM-dd'),
      status: 'pending'
    });

    setIsSubmitting(false);

    if (error) {
      toast.error('Failed to submit request');
    } else {
      toast.success('Mess off request submitted!');
      setLeavingDate(undefined);
      setReturnDate(undefined);
      fetchRequests();
    }
  };

  const chartData = [
    { name: 'Approved', value: requests.filter(r => r.status === 'approved').length, color: '#22c55e' },
    { name: 'Pending', value: requests.filter(r => r.status === 'pending').length, color: '#f59e0b' },
    { name: 'Rejected', value: requests.filter(r => r.status === 'rejected').length, color: '#ef4444' },
  ].filter(d => d.value > 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <DashboardLayout title="Mess Off" isAdmin={false}>
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Request Status Overview</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(222 47% 10%)', 
                        border: '1px solid hsl(222 47% 18%)',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  No requests yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Request Form */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Request Mess Off</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Leaving Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !leavingDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {leavingDate ? format(leavingDate, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={leavingDate}
                        onSelect={setLeavingDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">Return Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !returnDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {returnDate ? format(returnDate, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={returnDate}
                        onSelect={setReturnDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <Button type="submit" variant="hero" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : (
                    <>
                      Request Mess Off
                      <Send className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Request History */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Request History</CardTitle>
          </CardHeader>
          <CardContent>
            {requests.length > 0 ? (
              <div className="space-y-3">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-secondary"
                  >
                    <div>
                      <p className="text-foreground font-medium">
                        {format(new Date(request.leaving_date), 'MMM d, yyyy')} - {format(new Date(request.return_date), 'MMM d, yyyy')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Submitted on {format(new Date(request.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-sm font-medium",
                      request.status === 'approved' && "bg-success/20 text-success",
                      request.status === 'pending' && "bg-warning/20 text-warning",
                      request.status === 'rejected' && "bg-destructive/20 text-destructive"
                    )}>
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No mess off requests yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
