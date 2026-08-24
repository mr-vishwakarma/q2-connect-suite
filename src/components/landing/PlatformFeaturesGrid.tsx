import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Building2,
  DollarSign,
  Shield,
  Receipt,
  Shirt,
  MessageSquare,
  BarChart,
  Bell,
  Fingerprint,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Users,
    title: 'Student Life-Cycle',
    desc: 'Instant onboarding with ImageKit photo uploads, parent contacts, KYC documents, and room allocations.',
  },
  {
    icon: Building2,
    title: 'Room & Bed Allocations',
    desc: 'Visual floor-wise capacity management, single/double/triple room occupancy, and instant transfer tools.',
  },
  {
    icon: DollarSign,
    title: 'Automated Fee Ledgers',
    desc: 'Recurring monthly rent calculations, late fee rules, advance payments, and instant PDF receipt generation.',
  },
  {
    icon: Shield,
    title: 'Security Deposit Ledger',
    desc: 'Dedicated refundable deposit tracking, damage adjustments, forfeiture logs, and settlement receipts.',
  },
  {
    icon: Receipt,
    title: 'Utility Expense Tracker',
    desc: 'Log electricity bills, water, staff salaries, repairs, and daily groceries for complete net cashflow visibility.',
  },
  {
    icon: Fingerprint,
    title: 'Biometric & Attendance',
    desc: 'Smart digital gate entry tracking and automated mess off calculations with parental SMS alerts.',
  },
  {
    icon: Shirt,
    title: 'Laundry Slot Booking',
    desc: 'Resident washing machine scheduler preventing queues and streamlining laundry operations.',
  },
  {
    icon: MessageSquare,
    title: 'Digital Complaint Desk',
    desc: 'Categorized maintenance tickets (Plumbing, Wi-Fi, Food) with real-time status updates.',
  },
  {
    icon: BarChart,
    title: 'Financial & Occupancy Analytics',
    desc: 'Interactive collection rate charts, revenue forecasts, and historical occupancy trends.',
  },
  {
    icon: Bell,
    title: 'Multi-Channel Notifications',
    desc: 'Automated payment reminders, curfew alerts, and emergency announcements via In-App & SMS.',
  },
];

export function PlatformFeaturesGrid() {
  return (
    <section id="features" className="py-24 relative bg-card/30 border-t border-border/50">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
          <Badge variant="outline" className="text-xs font-semibold px-3 py-1 border-primary/30 text-primary">
            Comprehensive Capability Suite
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-black text-foreground tracking-tight">
            Everything Your Hostel Needs
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg">
            Say goodbye to fragmented spreadsheets and register books. Run your entire property from one intelligent SaaS suite.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 max-w-7xl mx-auto">
          {FEATURES.map((feat, idx) => (
            <motion.div
              key={feat.title}
              whileHover={{ y: -4, scale: 1.02 }}
              className="bg-card border border-border/70 rounded-2xl p-5 space-y-3 shadow-md hover:border-primary/50 transition-all flex flex-col"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                <feat.icon className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-foreground">{feat.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed flex-1">{feat.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
