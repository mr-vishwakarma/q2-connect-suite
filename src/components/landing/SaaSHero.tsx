import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Building2,
  Users,
  CheckCircle2,
  TrendingUp,
  CreditCard,
  Phone,
  User,
  Calendar,
  DollarSign,
} from 'lucide-react';

// Sample students for the Signature Fee Matrix
const MATRIX_STUDENTS = [
  { id: '1', name: 'Ananya Sharma', initials: 'AS', room: 'A-101', status: 'PAID', amount: 8500, phone: '+91 98765 43210', deposit: 10000 },
  { id: '2', name: 'Pooja Verma', initials: 'PV', room: 'A-101', status: 'PAID', amount: 8500, phone: '+91 98765 43211', deposit: 10000 },
  { id: '3', name: 'Ritu Patel', initials: 'RP', room: 'A-102', status: 'PENDING', amount: 9000, phone: '+91 98765 43212', deposit: 10000 },
  { id: '4', name: 'Sneha Reddy', initials: 'SR', room: 'A-102', status: 'PAID', amount: 9000, phone: '+91 98765 43213', deposit: 10000 },
  { id: '5', name: 'Kavya Nair', initials: 'KN', room: 'A-103', status: 'OVERDUE', amount: 8500, phone: '+91 98765 43214', deposit: 10000 },
  { id: '6', name: 'Megha Gupta', initials: 'MG', room: 'A-103', status: 'PAID', amount: 8500, phone: '+91 98765 43215', deposit: 10000 },
  { id: '7', name: 'Divya Iyer', initials: 'DI', room: 'A-104', status: 'UPCOMING', amount: 9500, phone: '+91 98765 43216', deposit: 10000 },
  { id: '8', name: 'Tanya Singh', initials: 'TS', room: 'A-104', status: 'PAID', amount: 9500, phone: '+91 98765 43217', deposit: 10000 },
  { id: '9', name: 'Sonal Joshi', initials: 'SJ', room: 'A-201', status: 'PAID', amount: 8500, phone: '+91 98765 43218', deposit: 10000 },
  { id: '10', name: 'Bhavna K', initials: 'BK', room: 'A-201', status: 'PENDING', amount: 8500, phone: '+91 98765 43219', deposit: 10000 },
  { id: '11', name: 'Aditi Rao', initials: 'AR', room: 'A-202', status: 'PAID', amount: 9000, phone: '+91 98765 43220', deposit: 10000 },
  { id: '12', name: 'Ishita Jain', initials: 'IJ', room: 'A-202', status: 'PAID', amount: 9000, phone: '+91 98765 43221', deposit: 10000 },
  { id: '13', name: 'Swati Menon', initials: 'SM', room: 'A-203', status: 'OVERDUE', amount: 8500, phone: '+91 98765 43222', deposit: 10000 },
  { id: '14', name: 'Neha Chawla', initials: 'NC', room: 'A-203', status: 'PAID', amount: 8500, phone: '+91 98765 43223', deposit: 10000 },
  { id: '15', name: 'Kritika Roy', initials: 'KR', room: 'A-204', status: 'PAID', amount: 9500, phone: '+91 98765 43224', deposit: 10000 },
  { id: '16', name: 'Shruti Das', initials: 'SD', room: 'A-204', status: 'UPCOMING', amount: 9500, phone: '+91 98765 43225', deposit: 10000 },
  { id: '17', name: 'Garima Saxena', initials: 'GS', room: 'A-301', status: 'PAID', amount: 8500, phone: '+91 98765 43226', deposit: 10000 },
  { id: '18', name: 'Monika Paul', initials: 'MP', room: 'A-301', status: 'PAID', amount: 8500, phone: '+91 98765 43227', deposit: 10000 },
  { id: '19', name: 'Pallavi Sen', initials: 'PS', room: 'A-302', status: 'PENDING', amount: 9000, phone: '+91 98765 43228', deposit: 10000 },
  { id: '20', name: 'Deepika M', initials: 'DM', room: 'A-302', status: 'PAID', amount: 9000, phone: '+91 98765 43229', deposit: 10000 },
  { id: '21', name: 'Shreya Tiwari', initials: 'ST', room: 'A-303', status: 'PAID', amount: 8500, phone: '+91 98765 43230', deposit: 10000 },
  { id: '22', name: 'Simran Kaur', initials: 'SK', room: 'A-303', status: 'OVERDUE', amount: 8500, phone: '+91 98765 43231', deposit: 10000 },
  { id: '23', name: 'Priyanka D', initials: 'PD', room: 'A-304', status: 'PAID', amount: 9500, phone: '+91 98765 43232', deposit: 10000 },
  { id: '24', name: 'Tanvi Shah', initials: 'TS', room: 'A-304', status: 'PAID', amount: 9500, phone: '+91 98765 43233', deposit: 10000 },
];

export function SaaSHero() {
  const [selectedStudent, setSelectedStudent] = useState<typeof MATRIX_STUDENTS[0] | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-emerald-500/20';
      case 'PENDING':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/50 shadow-rose-500/20';
      case 'OVERDUE':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-amber-500/20';
      case 'UPCOMING':
        return 'bg-sky-500/20 text-sky-400 border-sky-500/50 shadow-sky-500/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">✓ Fee Paid</Badge>;
      case 'PENDING':
        return <Badge className="bg-rose-500/20 text-rose-400 border border-rose-500/40">× Payment Pending</Badge>;
      case 'OVERDUE':
        return <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/40">! Overdue Fee</Badge>;
      case 'UPCOMING':
        return <Badge className="bg-sky-500/20 text-sky-400 border border-sky-500/40">→ Due in 5 Days</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <section id="hero" className="relative min-h-[95vh] pt-32 pb-20 overflow-hidden flex flex-col justify-center">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-primary/25 via-purple-600/20 to-transparent blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-1/2 right-10 w-[400px] h-[400px] bg-sky-500/10 blur-[120px] pointer-events-none -z-10" />

      <div className="container mx-auto px-4 sm:px-6">
        {/* Main Pitch */}
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-secondary/80 border border-primary/30 text-xs font-semibold text-foreground shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
            <span>Next-Gen Multi-Tenant Hostel SaaS Platform</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-6xl md:text-7xl font-black text-foreground tracking-tight leading-[1.1]"
          >
            Run Better Hostels With <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-primary via-purple-400 to-rose-400 bg-clip-text text-transparent">
              One Intelligent Platform
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto font-medium"
          >
            Manage students, rooms, fees, deposits, staff, analytics, and daily hostel operations from one connected Q2 platform.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-3 pt-2"
          >
            <Button size="lg" asChild className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-full px-7 shadow-lg shadow-primary/25 h-12">
              <Link to="/login" className="flex items-center gap-2">
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="rounded-full px-7 h-12 border-border/80 hover:bg-secondary/60 font-semibold">
              <a href="#experiences">Explore Platform</a>
            </Button>
          </motion.div>
        </div>

        {/* Hero Interactive Visualization — Student Fee Matrix & Dashboard Glass */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-14 max-w-5xl mx-auto"
        >
          <div className="relative rounded-2xl bg-card/60 backdrop-blur-2xl border border-border/80 shadow-2xl overflow-hidden p-4 sm:p-7">
            {/* Top Mock Window Bar */}
            <div className="flex items-center justify-between pb-5 border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="text-xs font-mono text-muted-foreground ml-2">Q2 Girls Hostel — Interactive Student Fee Matrix</span>
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className="flex items-center gap-1 text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Paid</span>
                <span className="flex items-center gap-1 text-rose-400"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Pending</span>
                <span className="flex items-center gap-1 text-amber-400"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Overdue</span>
                <span className="flex items-center gap-1 text-sky-400"><span className="w-2 h-2 rounded-full bg-sky-500 inline-block" /> Upcoming</span>
              </div>
            </div>

            {/* Quick KPI Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5">
              <div className="bg-secondary/40 border border-border/50 rounded-xl p-3">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Collection Efficiency</span>
                <div className="text-xl font-extrabold text-emerald-400">91.8%</div>
              </div>
              <div className="bg-secondary/40 border border-border/50 rounded-xl p-3">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Total Collected</span>
                <div className="text-xl font-extrabold text-foreground">₹4,76,000</div>
              </div>
              <div className="bg-secondary/40 border border-border/50 rounded-xl p-3">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Pending Invoices</span>
                <div className="text-xl font-extrabold text-rose-400">₹68,500</div>
              </div>
              <div className="bg-secondary/40 border border-border/50 rounded-xl p-3">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Hostel Occupancy</span>
                <div className="text-xl font-extrabold text-primary">96.4%</div>
              </div>
            </div>

            {/* Student Fee Matrix Balls Grid */}
            <div className="bg-background/50 border border-border/50 rounded-xl p-4 sm:p-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Live Resident Fee Indicators (Click any student to inspect)
                </h4>
                <Badge variant="outline" className="text-[10px] font-mono">24 Active Residents</Badge>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3 sm:gap-4 py-2">
                {MATRIX_STUDENTS.map((student) => (
                  <motion.button
                    key={student.id}
                    onClick={() => setSelectedStudent(student)}
                    whileHover={{ scale: 1.15, y: -4 }}
                    whileTap={{ scale: 0.95 }}
                    className={`relative flex flex-col items-center justify-center p-2 rounded-2xl border transition-all duration-200 shadow-md ${getStatusColor(student.status)}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-background/80 flex items-center justify-center font-bold text-xs shadow-inner">
                      {student.initials}
                    </div>
                    <span className="text-[10px] font-extrabold mt-1.5 truncate max-w-[60px]">{student.room}</span>
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Student Inspector Modal Dialog */}
      <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
        <DialogContent className="sm:max-w-md">
          {selectedStudent && (
            <div>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-lg font-bold">{selectedStudent.name}</DialogTitle>
                  {getStatusBadge(selectedStudent.status)}
                </div>
              </DialogHeader>
              <div className="space-y-3 py-4 text-sm">
                <div className="grid grid-cols-2 gap-3 bg-secondary/30 p-3 rounded-xl border border-border/50">
                  <div>
                    <span className="text-xs text-muted-foreground block">Assigned Room</span>
                    <span className="font-bold text-foreground">{selectedStudent.room}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Monthly Fee</span>
                    <span className="font-bold text-foreground">₹{selectedStudent.amount.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Security Deposit</span>
                    <span className="font-bold text-foreground">₹{selectedStudent.deposit.toLocaleString()} (Refundable)</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Contact</span>
                    <span className="font-mono text-xs text-foreground">{selectedStudent.phone}</span>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button className="w-full bg-primary text-primary-foreground font-bold" asChild>
                    <Link to="/login">Manage Student Record</Link>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
