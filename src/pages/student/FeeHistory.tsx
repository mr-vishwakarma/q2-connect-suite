import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { IndianRupee, Calendar, Check, AlertCircle, Download, Receipt } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { downloadReceipt, ReceiptData } from '@/lib/receiptPdf';

interface Fee {
  id: string; month: string; amount: number; paid_date: string | null;
  payment_mode: 'cash' | 'upi' | 'bank'; status: 'paid' | 'unpaid' | 'partial';
  late_fee: number; discount: number; paid_amount: number;
  due_date: string | null; receipt_no: string | null;
}

interface Payment {
  id: string; receipt_no: string; amount: number; late_fee: number; discount: number;
  security_deposit: number; payment_mode: 'cash' | 'upi' | 'bank';
  payment_date: string; month: string; admin_name: string | null; notes: string | null;
}

interface StudentData {
  id: string; name: string; username: string; room_no: string | null;
  fees: number | null; hostel: string;
}

export default function FeeHistory() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [student, setStudent] = useState<StudentData | null>(null);
  const [fees, setFees] = useState<Fee[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
    if (!authLoading && isAdmin) navigate('/admin/dashboard');
  }, [user, authLoading, isAdmin, navigate]);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    try {
      const { data: s } = await supabase.from('students')
        .select('id,name,username,room_no,fees,hostel')
        .eq('user_id', user.id).maybeSingle();
      if (!s) { setStudent(null); return; }
      setStudent(s as StudentData);

      const [fRes, pRes] = await Promise.all([
        supabase.from('fees').select('*').eq('student_id', s.id).order('created_at', { ascending: false }),
        supabase.from('fee_payments').select('*').eq('student_id', s.id).order('payment_date', { ascending: false }),
      ]);
      setFees((fRes.data || []) as Fee[]);
      setPayments((pRes.data || []) as Payment[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { if (user) fetchAll(); }, [user, fetchAll]);

  useEffect(() => {
    if (!student) return;
    const ch = supabase.channel(`stu-fees-${student.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fees' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fee_payments' }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [student, fetchAll]);

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount) + Number(p.security_deposit), 0);
  const totalPending = fees.reduce((s, f) => s + Math.max(0, f.amount + (f.late_fee || 0) - (f.discount || 0) - (f.paid_amount || 0)), 0);
  const lastPayment = payments[0];

  const downloadFor = (p: Payment) => {
    if (!student) return;
    const d: ReceiptData = {
      receipt_no: p.receipt_no, payment_date: p.payment_date,
      student_name: student.name, username: student.username, room_no: student.room_no,
      hostel: student.hostel, month: p.month, monthly_fee: p.amount,
      late_fee: p.late_fee, discount: p.discount, security_deposit: p.security_deposit,
      amount_paid: Number(p.amount) + Number(p.security_deposit),
      payment_mode: p.payment_mode, admin_name: p.admin_name, notes: p.notes,
    };
    downloadReceipt(d);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <DashboardLayout title="My Fees" isAdmin={false}>
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card className="bg-card border-border"><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-3 rounded-xl bg-primary/10"><IndianRupee className="w-6 h-6 text-primary" /></div><div><p className="text-sm text-muted-foreground">Records</p><p className="text-2xl font-bold text-foreground">{fees.length}</p></div></div></CardContent></Card>
          <Card className="bg-card border-border"><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-3 rounded-xl bg-success/10"><Check className="w-6 h-6 text-success" /></div><div><p className="text-sm text-muted-foreground">Total Paid</p><p className="text-2xl font-bold text-foreground">₹{totalPaid.toLocaleString('en-IN')}</p></div></div></CardContent></Card>
          <Card className="bg-card border-border"><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-3 rounded-xl bg-destructive/10"><AlertCircle className="w-6 h-6 text-destructive" /></div><div><p className="text-sm text-muted-foreground">Pending</p><p className="text-2xl font-bold text-foreground">₹{totalPending.toLocaleString('en-IN')}</p></div></div></CardContent></Card>
          <Card className="bg-card border-border"><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-3 rounded-xl bg-warning/10"><Calendar className="w-6 h-6 text-warning" /></div><div><p className="text-sm text-muted-foreground">Last Payment</p><p className="text-sm font-bold text-foreground">{lastPayment ? format(parseISO(lastPayment.payment_date), 'dd MMM yyyy') : 'N/A'}</p></div></div></CardContent></Card>
        </div>

        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><IndianRupee className="w-5 h-5" />Monthly Fee Status</CardTitle></CardHeader>
          <CardContent>
            {fees.length === 0 ? <div className="text-center py-8 text-muted-foreground">No fee records yet</div> : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Month</TableHead><TableHead>Amount</TableHead><TableHead>Late</TableHead><TableHead>Discount</TableHead><TableHead>Paid</TableHead><TableHead>Balance</TableHead><TableHead>Due Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {fees.map(f => {
                      const bal = Math.max(0, f.amount + (f.late_fee || 0) - (f.discount || 0) - (f.paid_amount || 0));
                      return (
                        <TableRow key={f.id}>
                          <TableCell className="text-foreground font-medium">{f.month}</TableCell>
                          <TableCell className="text-foreground">₹{f.amount}</TableCell>
                          <TableCell className="text-foreground">₹{f.late_fee || 0}</TableCell>
                          <TableCell className="text-foreground">₹{f.discount || 0}</TableCell>
                          <TableCell className="text-foreground">₹{f.paid_amount || 0}</TableCell>
                          <TableCell className="text-foreground font-bold">₹{bal}</TableCell>
                          <TableCell className="text-foreground text-xs">{f.due_date ? format(parseISO(f.due_date), 'dd MMM yyyy') : '-'}</TableCell>
                          <TableCell>
                            {f.status === 'paid' ? <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Paid</Badge>
                              : f.status === 'partial' ? <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">Partial</Badge>
                              : <Badge variant="destructive">Unpaid</Badge>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><Receipt className="w-5 h-5" />Payment Receipts</CardTitle></CardHeader>
          <CardContent>
            {payments.length === 0 ? <div className="text-center py-8 text-muted-foreground">No payments yet</div> : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Receipt No</TableHead><TableHead>Month</TableHead><TableHead>Amount</TableHead><TableHead>Mode</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {payments.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="text-foreground">{format(parseISO(p.payment_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell className="text-foreground font-mono text-xs">{p.receipt_no}</TableCell>
                        <TableCell className="text-foreground">{p.month}</TableCell>
                        <TableCell className="text-foreground font-bold">₹{(Number(p.amount) + Number(p.security_deposit)).toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-foreground uppercase text-xs">{p.payment_mode}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => downloadFor(p)}>
                            <Download className="w-4 h-4 mr-1" />PDF
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
