import { useEffect, useState } from 'react';
import { Plus, Receipt, Trash2, Calendar, DollarSign, Tag, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { expenseService } from '@/services/api/expense.service';
import { useHostel } from '@/contexts/HostelContext';
import { Expense } from '@/types';
import { toast } from 'react-toastify';

export default function ExpenseManagement() {
  const { selectedHostel } = useHostel();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [form, setForm] = useState({
    category: 'ELECTRICITY',
    amount: '',
    vendor: '',
    description: '',
    paymentMode: 'UPI',
  });

  useEffect(() => {
    fetchExpenses();
  }, [selectedHostel]);

  const fetchExpenses = async () => {
    try {
      setIsLoading(true);
      const res = await expenseService.getExpenses({ hostel: selectedHostel });
      if (res.success && res.data) {
        setExpenses(res.data);
      }
    } catch (error) {
      console.error('Failed to load expenses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      const res = await expenseService.createExpense({
        ...form,
        amount: Number(form.amount),
        hostelId: selectedHostel,
      } as any);

      if (res.success) {
        toast.success('Expense recorded successfully!');
        setIsCreateOpen(false);
        setForm({ category: 'ELECTRICITY', amount: '', vendor: '', description: '', paymentMode: 'UPI' });
        fetchExpenses();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to record expense');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense record?')) return;
    try {
      const res = await expenseService.deleteExpense(id);
      if (res.success) {
        toast.success('Expense deleted');
        fetchExpenses();
      }
    } catch (error) {
      toast.error('Failed to delete expense');
    }
  };

  const totalExpense = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Expense Tracker & Cashflow</h1>
          <p className="text-sm text-muted-foreground">Log utility bills, staff salaries, repairs, and daily operational expenditures.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
          <Plus className="w-4 h-4 mr-2" />
          Record New Expense
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Total Recorded Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">₹{totalExpense.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">{expenses.length} Records total</p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Active Branch Scope</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{selectedHostel || 'All Branches'}</div>
            <p className="text-xs text-muted-foreground mt-1">Multi-tenant isolated ledger</p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Average Expense Ticket</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              ₹{expenses.length ? Math.round(totalExpense / expenses.length).toLocaleString() : '0'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Per transaction average</p>
          </CardContent>
        </Card>
      </div>

      {/* Expenses Table */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-secondary/40 text-muted-foreground text-xs uppercase border-b border-border/50">
                <tr>
                  <th className="p-4">Date</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Description / Vendor</th>
                  <th className="p-4">Payment Mode</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {expenses.length > 0 ? (
                  expenses.map((exp) => (
                    <tr key={exp._id || exp.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="p-4 text-xs font-mono text-muted-foreground">
                        {new Date(exp.date).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className="text-xs font-semibold">
                          {exp.category}
                        </Badge>
                      </td>
                      <td className="p-4 text-xs">
                        <span className="font-semibold text-foreground block">{exp.description}</span>
                        {exp.vendor && <span className="text-muted-foreground">Vendor: {exp.vendor}</span>}
                      </td>
                      <td className="p-4 text-xs font-mono text-muted-foreground">
                        {exp.paymentMode}
                      </td>
                      <td className="p-4 font-bold text-destructive text-sm">
                        ₹{exp.amount.toLocaleString()}
                      </td>
                      <td className="p-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(exp._id || (exp.id as string))}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                      No expense records found. Click "Record New Expense" to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Record Expense Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Operational Expense</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={(val) => setForm({ ...form, category: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ELECTRICITY">Electricity</SelectItem>
                    <SelectItem value="WATER">Water</SelectItem>
                    <SelectItem value="FOOD">Food / Groceries</SelectItem>
                    <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                    <SelectItem value="SALARY">Staff Salary</SelectItem>
                    <SelectItem value="INTERNET">Internet / Wi-Fi</SelectItem>
                    <SelectItem value="CLEANING">Cleaning Supplies</SelectItem>
                    <SelectItem value="OTHER">Other Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Amount (₹) *</Label>
                <Input
                  type="number"
                  required
                  placeholder="e.g. 4500"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description *</Label>
              <Input
                required
                placeholder="e.g. July month electricity bill for Floor 1-3"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Vendor / Payee</Label>
                <Input
                  placeholder="e.g. TSSPDCL / Local Plumber"
                  value={form.vendor}
                  onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Payment Mode</Label>
                <Select value={form.paymentMode} onValueChange={(val) => setForm({ ...form, paymentMode: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    <SelectItem value="CARD">Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-primary text-primary-foreground font-semibold">
                Save Expense
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
