import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Calendar, Send, Upload, FileCheck, History, FileText, X } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface LeaveRequest {
  id: string;
  leaving_date: string;
  return_date: string;
  reason: string | null;
  status: string;
  admin_message: string | null;
  created_at: string;
  document_url: string | null;
  document_name: string | null;
  approved_date: string | null;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
const MAX_SIZE = 1024 * 1024; // 1 MB

export default function MessOff() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [leavingDate, setLeavingDate] = useState<Date>();
  const [returnDate, setReturnDate] = useState<Date>();
  const [reason, setReason] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [studentHostel, setStudentHostel] = useState<'Q2' | 'Q2.0' | 'Q2.1' | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate('/login');
    if (!loading && isAdmin) navigate('/admin/dashboard');
  }, [user, loading, isAdmin, navigate]);

  useEffect(() => {
    if (user) {
      fetchRequests();
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

  const fetchRequests = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('mess_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error && data) setRequests(data as LeaveRequest[]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Only JPG, PNG, and PDF files are allowed.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error('File size must be less than 1 MB.');
      e.target.value = '';
      return;
    }
    setDocumentFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!leavingDate || !returnDate) {
      toast.error('Please select both dates');
      return;
    }
    if (!reason.trim()) {
      toast.error('Please provide a reason for leave');
      return;
    }
    if (returnDate <= leavingDate) {
      toast.error('Return date must be after leaving date');
      return;
    }
    if (!documentFile) {
      toast.error('Please upload the Q2 Hostel Leave Document.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload document
      const ext = documentFile.name.split('.').pop();
      const filePath = `${user!.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('leave-documents')
        .upload(filePath, documentFile, { upsert: false });

      if (uploadErr) throw uploadErr;

      // Fetch parent phone from students
      const { data: studentData } = await supabase
        .from('students')
        .select('parent_phone')
        .eq('user_id', user!.id)
        .maybeSingle();

      const { error } = await supabase.from('mess_requests').insert({
        user_id: user!.id,
        leaving_date: format(leavingDate, 'yyyy-MM-dd'),
        return_date: format(returnDate, 'yyyy-MM-dd'),
        reason: reason.trim(),
        status: 'pending',
        hostel: studentHostel,
        document_url: filePath,
        document_name: documentFile.name,
        parent_mobile: studentData?.parent_phone || null,
      });

      if (error) throw error;

      toast.success('Leave request submitted!');
      setLeavingDate(undefined);
      setReturnDate(undefined);
      setReason('');
      setDocumentFile(null);
      fetchRequests();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
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

  const chartData = [
    { name: 'Approved', value: requests.filter(r => r.status === 'approved').length, color: '#22c55e' },
    { name: 'Pending', value: requests.filter(r => r.status === 'pending').length, color: '#facc15' },
    { name: 'Returned', value: requests.filter(r => r.status === 'returned').length, color: '#3b82f6' },
    { name: 'Rejected', value: requests.filter(r => r.status === 'rejected').length, color: '#ef4444' },
  ].filter(d => d.value > 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const renderStatusBadge = (status: string) => (
    <span className={cn(
      "px-3 py-1 rounded-full text-sm font-medium",
      status === 'approved' && "bg-green-500/20 text-green-400",
      status === 'pending' && "bg-yellow-500/20 text-yellow-400",
      status === 'returned' && "bg-blue-500/20 text-blue-400",
      status === 'rejected' && "bg-red-500/20 text-red-400"
    )}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );

  return (
    <DashboardLayout title="Leave Request" isAdmin={false}>
      <div className="space-y-6 animate-fade-in">
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => setHistoryOpen(true)} className="gap-2">
            <History className="w-4 h-4" />
            View My Leave History
          </Button>
        </div>

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
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(222 47% 10%)',
                        border: '1px solid hsl(222 47% 18%)',
                        borderRadius: '8px',
                        color: '#ffffff',
                      }}
                      itemStyle={{ color: '#ffffff' }}
                    />
                    <Legend formatter={(value) => <span style={{ color: '#ffffff', fontWeight: 500 }}>{value}</span>} />
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
              <CardTitle className="text-foreground">Request Leave</CardTitle>
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

                <div className="space-y-2">
                  <Label className="text-foreground">Reason for Leave <span className="text-destructive">*</span></Label>
                  <Textarea
                    placeholder="Why are you going home?"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="min-h-[80px] bg-secondary border-border"
                    required
                  />
                </div>

                {/* Document Upload */}
                <div className="space-y-2">
                  <Label className="text-foreground">
                    Upload Leave Document <span className="text-destructive">*</span>
                  </Label>
                  <label
                    htmlFor="leave-doc"
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all",
                      documentFile
                        ? "border-green-500/50 bg-green-500/5"
                        : "border-primary/40 bg-secondary hover:border-primary hover:bg-primary/5"
                    )}
                  >
                    {documentFile ? (
                      <>
                        <FileCheck className="w-7 h-7 text-green-400" />
                        <p className="text-sm font-medium text-foreground truncate max-w-full">
                          {documentFile.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(documentFile.size / 1024).toFixed(1)} KB · Click to change
                        </p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-7 h-7 text-primary" />
                        <p className="text-sm font-medium text-foreground">Upload Q2 Hostel Leave Document</p>
                        <p className="text-xs text-muted-foreground">JPG, PNG or PDF · Max 1 MB</p>
                      </>
                    )}
                    <input
                      id="leave-doc"
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  {documentFile && (
                    <button
                      type="button"
                      onClick={() => setDocumentFile(null)}
                      className="text-xs text-destructive hover:underline flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Remove file
                    </button>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : (
                    <>
                      Request Leave
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
                  <div key={request.id} className="p-4 rounded-xl bg-secondary space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="text-foreground font-medium">
                          {format(new Date(request.leaving_date), 'MMM d, yyyy')} - {format(new Date(request.return_date), 'MMM d, yyyy')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Submitted on {format(new Date(request.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      {renderStatusBadge(request.status)}
                    </div>
                    {request.reason && (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Reason:</span> {request.reason}
                      </p>
                    )}
                    {request.document_url && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => viewDocument(request.document_url!)}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        View Document
                      </Button>
                    )}
                    {request.admin_message && (
                      <div className="bg-primary/10 rounded-lg p-2 border border-primary/20">
                        <p className="text-xs text-primary font-medium">Admin Message:</p>
                        <p className="text-sm text-foreground">{request.admin_message}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No leave requests yet</p>
            )}
          </CardContent>
        </Card>

        {/* Leave History Modal */}
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground flex items-center gap-2">
                <History className="w-5 h-5 text-primary" /> My Leave History
              </DialogTitle>
            </DialogHeader>
            {requests.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No leave history found</p>
            ) : (
              <div className="space-y-3">
                {requests.map((r) => (
                  <div key={r.id} className="p-4 rounded-xl bg-secondary space-y-2 border border-border">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <p className="text-foreground font-medium">
                        {format(new Date(r.leaving_date), 'MMM d, yyyy')} → {format(new Date(r.return_date), 'MMM d, yyyy')}
                      </p>
                      {renderStatusBadge(r.status)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Applied on {format(new Date(r.created_at), 'MMM d, yyyy')}
                      {r.approved_date && ` · Approved on ${format(new Date(r.approved_date), 'MMM d, yyyy')}`}
                    </div>
                    {r.reason && (
                      <p className="text-sm text-foreground">
                        <span className="text-muted-foreground">Reason:</span> {r.reason}
                      </p>
                    )}
                    {r.document_url && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => viewDocument(r.document_url!)}
                      >
                        <FileText className="w-3.5 h-3.5" /> View Document
                      </Button>
                    )}
                    {r.admin_message && (
                      <div className="bg-primary/10 rounded-lg p-2 border border-primary/20">
                        <p className="text-xs text-primary font-medium">Admin Message:</p>
                        <p className="text-sm text-foreground">{r.admin_message}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
