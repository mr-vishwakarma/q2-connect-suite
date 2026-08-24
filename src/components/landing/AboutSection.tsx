import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  Building2,
  ShieldCheck,
  Heart,
  Users,
  Award,
  Sparkles,
  MapPin,
  Phone,
  Mail,
  ArrowRight,
} from 'lucide-react';

const STATS = [
  { value: '150+', label: 'Families Trusting Q2' },
  { value: '3', label: 'Prime Tech Hub Branches' },
  { value: '100%', label: 'Dedicated Girls Safety' },
  { value: '24/7', label: 'CCTV & Biometric Security' },
];

const VALUES = [
  {
    icon: ShieldCheck,
    title: 'Safety First Philosophy',
    desc: 'Round-the-clock female wardens, biometric digital entry locks, and full CCTV surveillance ensuring absolute safety for every resident.',
  },
  {
    icon: Heart,
    title: 'Comfortable & Hygienic Living',
    desc: 'Clean, sanitized AC rooms, high-speed Wi-Fi, nutritious home-style meals, pure RO drinking water, and on-premise laundry machines.',
  },
  {
    icon: Sparkles,
    title: 'Intelligent SaaS Technology',
    desc: 'Transparent digital fee receipts, 1-tap mess-off adjustments, room allocation transparency, and instant maintenance ticketing.',
  },
];

export function AboutSection() {
  return (
    <section id="about" className="py-24 relative bg-card/20 border-t border-border/50 overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
          <Badge variant="outline" className="text-xs font-semibold px-3 py-1 border-primary/30 text-primary">
            Our Mission & Story
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-black text-foreground tracking-tight">
            About Q2 Group of Hostels
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg">
            Founded with a vision to redefine student accommodations into safe, supportive, and technologically-empowered digital communities.
          </p>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto mb-16">
          {STATS.map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.08 }}
              className="bg-card border border-border/70 rounded-2xl p-6 text-center space-y-1 shadow-sm"
            >
              <div className="text-3xl sm:text-4xl font-black text-primary font-mono">{stat.value}</div>
              <p className="text-xs text-muted-foreground font-semibold">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Story & Values Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto mb-16">
          {VALUES.map((val, idx) => (
            <motion.div
              key={val.title}
              whileHover={{ y: -6 }}
              className="bg-card border border-border/80 rounded-2xl p-7 space-y-4 shadow-md hover:border-primary/50 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                <val.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-foreground">{val.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{val.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Branch Network Highlights */}
        <div className="max-w-5xl mx-auto bg-gradient-to-r from-card via-secondary/30 to-card border border-border/80 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg">
          <div className="space-y-2">
            <h4 className="text-lg font-bold text-foreground">Explore Our Prime Hostel Locations</h4>
            <p className="text-xs text-muted-foreground">
              Branches across <strong>Patel Nagar (Bhopal)</strong> and <strong>Financial District, Gachibowli (Hyderabad)</strong>.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Button variant="outline" asChild className="rounded-full text-xs font-bold border-border/80">
              <Link to="/contact">Contact Hostel Office</Link>
            </Button>
            <Button asChild className="rounded-full text-xs font-bold bg-primary text-primary-foreground shadow-md shadow-primary/25">
              <Link to="/login" className="flex items-center gap-1.5">
                <span>Access Student Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
