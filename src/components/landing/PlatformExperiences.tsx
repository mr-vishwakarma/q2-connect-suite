import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ShieldAlert,
  Building2,
  GraduationCap,
  ArrowRight,
  TrendingUp,
  CreditCard,
  Users,
  CheckCircle2,
  FileText,
  BedDouble,
  BellRing,
} from 'lucide-react';

export function PlatformExperiences() {
  const [activeTab, setActiveTab] = useState<'super_admin' | 'hostel_admin' | 'student'>('hostel_admin');

  return (
    <section id="experiences" className="py-24 relative bg-card/40 border-t border-b border-border/50">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
          <Badge variant="outline" className="text-xs font-semibold px-3 py-1 border-primary/30 text-primary">
            Universal SaaS Ecosystem
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-black text-foreground tracking-tight">
            One Platform. Three Experiences.
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg">
            Purpose-built interfaces designed for platform operators, hostel management teams, and resident students.
          </p>

          {/* Experience Switcher Tabs */}
          <div className="flex justify-center gap-2 pt-4">
            <Button
              variant={activeTab === 'super_admin' ? 'default' : 'outline'}
              onClick={() => setActiveTab('super_admin')}
              className="rounded-full text-xs font-bold"
            >
              <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />
              Super Admin
            </Button>
            <Button
              variant={activeTab === 'hostel_admin' ? 'default' : 'outline'}
              onClick={() => setActiveTab('hostel_admin')}
              className="rounded-full text-xs font-bold"
            >
              <Building2 className="w-3.5 h-3.5 mr-1.5" />
              Hostel Management
            </Button>
            <Button
              variant={activeTab === 'student' ? 'default' : 'outline'}
              onClick={() => setActiveTab('student')}
              className="rounded-full text-xs font-bold"
            >
              <GraduationCap className="w-3.5 h-3.5 mr-1.5" />
              Student Resident
            </Button>
          </div>
        </div>

        {/* 3 Experience Cards Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {/* Card 1: Super Admin */}
          <motion.div
            whileHover={{ y: -6 }}
            className={`rounded-2xl border transition-all duration-300 ${
              activeTab === 'super_admin'
                ? 'bg-card border-primary/60 shadow-xl shadow-primary/10 ring-2 ring-primary/20'
                : 'bg-card/60 border-border/60'
            }`}
          >
            <CardHeader className="pb-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center mb-3">
                <ShieldAlert className="w-6 h-6 text-purple-400" />
              </div>
              <CardTitle className="text-xl font-bold text-foreground">Super Administrator</CardTitle>
              <CardDescription>Multi-Tenant Platform Control & MRR Governance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Manage the entire Q2 hostel network, onboard independent tenants, configure subscription plans, toggle feature access, and monitor platform collection efficiency.
              </p>

              <div className="space-y-2 bg-secondary/30 p-3 rounded-xl border border-border/40 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Active Hostels</span>
                  <span className="font-bold text-foreground">48 Properties</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Monthly Recurring Revenue</span>
                  <span className="font-bold text-emerald-400">₹14.2 Lakhs</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Tenant Isolation</span>
                  <Badge variant="outline" className="text-[10px] text-emerald-400">Enforced</Badge>
                </div>
              </div>

              <Button asChild variant="outline" className="w-full font-bold text-xs border-primary/40 hover:bg-primary/10">
                <Link to="/login?role=super_admin" className="flex items-center justify-center gap-1.5">
                  <span>Super Admin Login</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </Button>
            </CardContent>
          </motion.div>

          {/* Card 2: Hostel Management */}
          <motion.div
            whileHover={{ y: -6 }}
            className={`rounded-2xl border transition-all duration-300 ${
              activeTab === 'hostel_admin'
                ? 'bg-card border-primary shadow-2xl shadow-primary/20 ring-2 ring-primary/30'
                : 'bg-card/60 border-border/60'
            }`}
          >
            <CardHeader className="pb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center mb-3">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-xl font-bold text-foreground">Hostel Management</CardTitle>
              <CardDescription>Daily Operations, Rooms & Fee Ledgers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Complete operational cockpit for Hostel Owners, Wardens, and Accountants. Track floor-wise room occupancy, student payment ledgers, utility expenses, and complaints.
              </p>

              <div className="space-y-2 bg-secondary/30 p-3 rounded-xl border border-border/40 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Signature Fee Matrix</span>
                  <Badge className="bg-emerald-500/20 text-emerald-400">Live Status</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Utility Expense Tracker</span>
                  <span className="font-bold text-foreground">Active</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Receipt PDF Generation</span>
                  <span className="font-bold text-foreground">Instant</span>
                </div>
              </div>

              <Button asChild className="w-full font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20">
                <Link to="/login?role=admin" className="flex items-center justify-center gap-1.5">
                  <span>Hostel Admin Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </Button>
            </CardContent>
          </motion.div>

          {/* Card 3: Student Resident */}
          <motion.div
            whileHover={{ y: -6 }}
            className={`rounded-2xl border transition-all duration-300 ${
              activeTab === 'student'
                ? 'bg-card border-primary/60 shadow-xl shadow-primary/10 ring-2 ring-primary/20'
                : 'bg-card/60 border-border/60'
            }`}
          >
            <CardHeader className="pb-4">
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center mb-3">
                <GraduationCap className="w-6 h-6 text-sky-400" />
              </div>
              <CardTitle className="text-xl font-bold text-foreground">Resident Portal</CardTitle>
              <CardDescription>Mobile-First Digital Living Experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Give female residents an intuitive portal to view their assigned room & roommates, check monthly fee status, download payment receipts, request mess leaves, and report issues.
              </p>

              <div className="space-y-2 bg-secondary/30 p-3 rounded-xl border border-border/40 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Bed & Room Details</span>
                  <span className="font-bold text-foreground">Assigned A-204</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Mess-Off Requests</span>
                  <span className="font-bold text-sky-400">1-Tap Apply</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Laundry Machine Booking</span>
                  <span className="font-bold text-foreground">Available</span>
                </div>
              </div>

              <Button asChild variant="outline" className="w-full font-bold text-xs border-sky-500/40 hover:bg-sky-500/10 text-foreground">
                <Link to="/login?role=student" className="flex items-center justify-center gap-1.5">
                  <span>Student Portal Login</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </Button>
            </CardContent>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
