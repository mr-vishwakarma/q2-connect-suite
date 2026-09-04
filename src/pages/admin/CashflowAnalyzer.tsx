import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  PieChart,
  Calendar,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useHostel } from '@/contexts/HostelContext';
import { expenseService } from '@/services/api/expense.service';
import { feeService } from '@/services/api/fee.service';
import { Expense } from '@/types';
import { format } from 'date-fns';

export default function CashflowAnalyzer() {
  const { selectedHostel } = useHostel();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalCollectedRent, setTotalCollectedRent] = useState(0);
  const [pendingRent, setPendingRent] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCashflowData();
  }, [selectedHostel, selectedMonth]);

  const fetchCashflowData = async () => {
    try {
      setIsLoading(true);
      const [expRes, feeDashRes] = await Promise.all([
        expenseService.getExpenses({ hostel: selectedHostel, month: selectedMonth }),
        feeService.getFeeDashboard({ hostel: selectedHostel }),
      ]);

      if (expRes.success && expRes.data) {
        setExpenses(expRes.data);
      } else {
        setExpenses([]);
      }

      if (feeDashRes.success && feeDashRes.data) {
        const selectedYearMonth = selectedMonth; // e.g. "2026-09"
        const allPayments = feeDashRes.data.payments || [];
        const monthFilteredPayments = allPayments.filter((p: any) => {
          if (!p.paymentDate) return true;
          try {
            return format(new Date(p.paymentDate), 'yyyy-MM') === selectedYearMonth;
          } catch {
            return true;
          }
        });

        // Use filtered payments if any match, or all payments if monthly filter isn't recorded
        const activePayments = monthFilteredPayments.length > 0 ? monthFilteredPayments : allPayments;
        const totalPaid = activePayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
        const totalFeeDues = (feeDashRes.data.fees || [])
          .filter((f: any) => f.status !== 'paid')
          .reduce((sum: number, f: any) => sum + (f.amount || 0), 0);

        setTotalCollectedRent(totalPaid);
        setPendingRent(totalFeeDues);
      } else {
        setTotalCollectedRent(0);
        setPendingRent(0);
      }
    } catch (error) {
      console.error('Failed to load cashflow data:', error);
      setTotalCollectedRent(0);
      setPendingRent(0);
      setExpenses([]);
    } finally {
      setIsLoading(false);
    }
  };

  const totalExpense = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const netOperatingProfit = totalCollectedRent - totalExpense;
  const profitMarginPercent = totalCollectedRent > 0 ? ((netOperatingProfit / totalCollectedRent) * 100).toFixed(1) : '0';

  // Group by category
  const categoryTotals: Record<string, number> = {};
  expenses.forEach((e) => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + (e.amount || 0);
  });

  const exportCashflowAudit = () => {
    const csvContent = [
      ['Metric', 'Amount (INR)'].join(','),
      ['Total Fee Collection (Inflow)', totalCollectedRent],
      ['Total Operational Expenses (Outflow)', totalExpense],
      ['Net Operating Cashflow', netOperatingProfit],
      ['Profit Margin %', `${profitMarginPercent}%`],
      ['Pending Uncollected Rent', pendingRent],
      [''],
      ['Category Breakdown', 'Amount (INR)'],
      ...Object.entries(categoryTotals).map(([cat, amt]) => [cat, amt]),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cashflow-${selectedHostel}-${selectedMonth}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cashflow & Profit/Loss Analyzer</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Synchronized view of fee revenues vs. utility & operational expenditures for net profit visibility.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-card border border-border/80 text-foreground text-xs rounded-xl px-3 py-2"
          />
          <Button onClick={exportCashflowAudit} variant="outline" size="sm" className="text-xs">
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Audit Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Inflow */}
        <Card className="border-border/60 bg-gradient-to-br from-emerald-950/20 to-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Total Inflow (Rent)</CardTitle>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-400">₹{totalCollectedRent.toLocaleString()}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Pending dues: ₹{pendingRent.toLocaleString()}</p>
          </CardContent>
        </Card>

        {/* Total Outflow */}
        <Card className="border-border/60 bg-gradient-to-br from-rose-950/20 to-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Total Outflow (Expenses)</CardTitle>
              <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
                <ArrowDownRight className="w-4 h-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-rose-400">₹{totalExpense.toLocaleString()}</div>
            <p className="text-[11px] text-muted-foreground mt-1">{expenses.length} Expense vouchers</p>
          </CardContent>
        </Card>

        {/* Net Profit */}
        <Card className="border-border/60 bg-gradient-to-br from-primary/20 to-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Net Cashflow</CardTitle>
              <div className="w-7 h-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-black ${netOperatingProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>
              ₹{netOperatingProfit.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Operating surplus</p>
          </CardContent>
        </Card>

        {/* Profit Margin */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Net Profit Margin</CardTitle>
              <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <Percent className="w-4 h-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-purple-400">{profitMarginPercent}%</div>
            <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Healthy Margin
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <PieChart className="w-4 h-4 text-primary" />
              Expenditure Breakdown by Category
            </CardTitle>
            <CardDescription className="text-xs">Category-wise operational allocation for selected period</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.keys(categoryTotals).length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">No expenses recorded for this month</div>
            ) : (
              Object.entries(categoryTotals).map(([cat, amt]) => {
                const pct = totalExpense > 0 ? ((amt / totalExpense) * 100).toFixed(1) : '0';
                return (
                  <div key={cat} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-foreground">{cat}</span>
                      <span className="text-muted-foreground font-mono">₹{amt.toLocaleString()} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Operational Insights */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Financial Health Insights
            </CardTitle>
            <CardDescription className="text-xs">Automated financial health score & suggestions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className={`p-3.5 rounded-xl border space-y-1 ${netOperatingProfit >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
              <h4 className={`font-bold text-sm ${netOperatingProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {netOperatingProfit >= 0 ? 'Positive Operating Cashflow' : 'Operating Deficit'}
              </h4>
              <p className="text-muted-foreground">
                {netOperatingProfit >= 0 
                  ? 'Your collected fee revenues exceed logged operational and maintenance expenditures for this period.'
                  : 'Operational expenses exceeded collected rent for this period. Review pending dues and operational costs.'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-secondary/40 border border-border/50 space-y-1">
              <h4 className="font-bold text-foreground text-sm">Uncollected Rent Status</h4>
              <p className="text-muted-foreground">
                {pendingRent > 0 ? (
                  <>
                    Pending fee dues stand at <strong>₹{pendingRent.toLocaleString()}</strong>.
                    {totalCollectedRent > 0 && (
                      <> Recovering these pending dues will add an additional <strong>+{((pendingRent / totalCollectedRent) * 100).toFixed(1)}%</strong> to your operating cashflow.</>
                    )} Use the Alerts tab to review student dues and send reminders.
                  </>
                ) : (
                  'All resident fee dues are settled for this hostel branch! No outstanding dues recorded.'
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
