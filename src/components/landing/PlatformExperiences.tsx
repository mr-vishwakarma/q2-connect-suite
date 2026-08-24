import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShieldAlert,
  Building2,
  GraduationCap,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  BedDouble,
  Receipt,
  FileCheck,
  Smartphone,
  Eye,
} from 'lucide-react';

export function PlatformExperiences() {
  const [activeTab, setActiveTab] = useState<'super_admin' | 'hostel_admin' | 'student'>('hostel_admin');

  return (
    <section id="experiences" className="py-24 relative bg-card/30 border-t border-b border-border/50 overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-14">
          <Badge variant="outline" className="text-xs font-semibold px-3 py-1 border-primary/30 text-primary">
            Universal SaaS Architecture
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-black text-foreground tracking-tight">
            One Platform. Three Experiences.
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg">
            Purpose-built operating cockpits tailored for platform leadership, hostel property teams, and resident students.
          </p>

          {/* Tab Selector */}
          <div className="flex flex-wrap justify-center gap-2 pt-4">
            <Button
              variant={activeTab === 'hostel_admin' ? 'default' : 'outline'}
              onClick={() => setActiveTab('hostel_admin')}
              className="rounded-full text-xs font-bold"
            >
              <Building2 className="w-3.5 h-3.5 mr-1.5" />
              Hostel Management Portal
            </Button>
            <Button
              variant={activeTab === 'student' ? 'default' : 'outline'}
              onClick={() => setActiveTab('student')}
              className="rounded-full text-xs font-bold"
            >
              <GraduationCap className="w-3.5 h-3.5 mr-1.5" />
              Resident Student App
            </Button>
            <Button
              variant={activeTab === 'super_admin' ? 'default' : 'outline'}
              onClick={() => setActiveTab('super_admin')}
              className="rounded-full text-xs font-bold"
            >
              <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />
              Super Admin Control
            </Button>
          </div>
        </div>

        {/* Dynamic Showcase Container */}
        <div className="max-w-6xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'hostel_admin' && (
              <motion.div
                key="hostel-admin-view"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-card/80 backdrop-blur-2xl border border-primary/40 rounded-3xl p-6 sm:p-10 shadow-2xl"
              >
                {/* Left Description */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="space-y-2">
                    <Badge className="bg-primary/20 text-primary border-primary/40 text-xs">
                      Daily Property Operations
                    </Badge>
                    <h3 className="text-2xl sm:text-3xl font-black text-foreground">
                      Hostel Management Cockpit
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      Manage floor-wise room allocations, monitor live fee collection with our signature student circular matrix, track utility expenses, and generate automated PDF receipts in seconds.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3 text-xs text-foreground/90">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>Interactive Student Fee Matrix:</strong> Real-time circular indicators for paid, pending, and overdue rents.</span>
                    </div>
                    <div className="flex items-start gap-3 text-xs text-foreground/90">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>Floor & Bed Allocator:</strong> Single, Double, Triple sharing room occupancy tracking with 1-click transfers.</span>
                    </div>
                    <div className="flex items-start gap-3 text-xs text-foreground/90">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>Utility Expense Tracker:</strong> Electricity, water, groceries, and staff salary ledgers.</span>
                    </div>
                  </div>

                  <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-full px-6 shadow-lg shadow-primary/25 h-11">
                    <Link to="/login?role=admin" className="flex items-center gap-2">
                      <span>Launch Hostel Management Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </Button>
                </div>

                {/* Right Visual Mockup */}
                <div className="lg:col-span-7 relative group">
                  <div className="relative rounded-2xl overflow-hidden border border-border/80 shadow-2xl bg-black/60 aspect-video">
                    <img
                      src="/assets/saas-dashboard-mockup.jpg"
                      alt="Q2 Hostel Management Dashboard"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs bg-background/80 backdrop-blur-md px-4 py-2 rounded-xl border border-border/60">
                      <span className="font-mono text-muted-foreground font-semibold">Q2 Connect Suite v2.0 • Live Ledger View</span>
                      <Badge variant="outline" className="text-emerald-400 border-emerald-500/40">91.8% Collection Rate</Badge>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'student' && (
              <motion.div
                key="student-view"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-card/80 backdrop-blur-2xl border border-sky-500/40 rounded-3xl p-6 sm:p-10 shadow-2xl"
              >
                {/* Left Description */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="space-y-2">
                    <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/40 text-xs">
                      Resident Digital Companion
                    </Badge>
                    <h3 className="text-2xl sm:text-3xl font-black text-foreground">
                      Student Resident Mobile App
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      Give female students an intuitive mobile companion to view their room & bed allocations, check fee payment receipts, request mess-off leaves, and rate daily meals.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3 text-xs text-foreground/90">
                      <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                      <span><strong>My Room & Roommates:</strong> Transparent bed assignment and floor info.</span>
                    </div>
                    <div className="flex items-start gap-3 text-xs text-foreground/90">
                      <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                      <span><strong>Instant Digital Receipts:</strong> Download official payment receipts anytime.</span>
                    </div>
                    <div className="flex items-start gap-3 text-xs text-foreground/90">
                      <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                      <span><strong>Mess-Off & Laundry:</strong> 1-tap leave requests and washing machine scheduler.</span>
                    </div>
                  </div>

                  <Button asChild className="bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs rounded-full px-6 shadow-lg shadow-sky-600/25 h-11">
                    <Link to="/login?role=student" className="flex items-center gap-2">
                      <span>Access Student Portal</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </Button>
                </div>

                {/* Right Visual Mockup */}
                <div className="lg:col-span-7 relative group">
                  <div className="relative rounded-2xl overflow-hidden border border-sky-500/30 shadow-2xl bg-black/60 aspect-video">
                    <img
                      src="/assets/student-mobile-mockup.jpg"
                      alt="Q2 Student Resident Mobile App"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs bg-background/80 backdrop-blur-md px-4 py-2 rounded-xl border border-border/60">
                      <span className="font-mono text-muted-foreground font-semibold">Q2 Resident App • Mobile & PWA Enabled</span>
                      <Badge variant="outline" className="text-sky-400 border-sky-500/40">Room A-204 Verified</Badge>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'super_admin' && (
              <motion.div
                key="super-admin-view"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-card/80 backdrop-blur-2xl border border-purple-500/40 rounded-3xl p-6 sm:p-10 shadow-2xl"
              >
                {/* Left Description */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="space-y-2">
                    <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-xs">
                      Platform Control & Governance
                    </Badge>
                    <h3 className="text-2xl sm:text-3xl font-black text-foreground">
                      Platform Super Administrator
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      Oversee multiple customer organizations, monitor Monthly Recurring Revenue (MRR), manage SaaS subscription plans, toggle feature access per tenant, and enforce security policies.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3 text-xs text-foreground/90">
                      <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                      <span><strong>Multi-Tenant Network Control:</strong> Onboard, monitor, or suspend hostel organizations in seconds.</span>
                    </div>
                    <div className="flex items-start gap-3 text-xs text-foreground/90">
                      <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                      <span><strong>Feature Flags & Plan Quotas:</strong> Enable biometric, laundry, or analytics modules per tenant.</span>
                    </div>
                    <div className="flex items-start gap-3 text-xs text-foreground/90">
                      <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                      <span><strong>Controlled Impersonation:</strong> Audit-logged troubleshooting support sessions.</span>
                    </div>
                  </div>

                  <Button asChild className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-full px-6 shadow-lg shadow-purple-600/25 h-11">
                    <Link to="/login?role=super_admin" className="flex items-center gap-2">
                      <span>Launch Super Admin Control</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </Button>
                </div>

                {/* Right Visual Mockup */}
                <div className="lg:col-span-7 relative group">
                  <div className="relative rounded-2xl overflow-hidden border border-purple-500/30 shadow-2xl bg-black/60 aspect-video">
                    <img
                      src="/assets/saas-dashboard-mockup.jpg"
                      alt="Q2 Platform Analytics & Governance"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs bg-background/80 backdrop-blur-md px-4 py-2 rounded-xl border border-border/60">
                      <span className="font-mono text-muted-foreground font-semibold">Q2 Super Admin • Platform Governance</span>
                      <Badge variant="outline" className="text-purple-400 border-purple-500/40">48 Active Tenants</Badge>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
