import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';
import { BuildingBackground } from '@/components/shared/BuildingBackground';
import {
  Video,
  Snowflake,
  Wifi,
  Droplet,
  Shirt,
  Fingerprint,
} from 'lucide-react';

const features = [
  {
    icon: Video,
    title: 'CCTV Surveillance 24/7',
    description: 'Entire hostel premises are monitored with high-quality CCTV cameras to ensure complete safety and security for all students.',
  },
  {
    icon: Snowflake,
    title: 'AC & Comfortable Rooms',
    description: 'Well-maintained Single, Double, and Triple Sharing AC rooms designed for comfortable and peaceful student living.',
  },
  {
    icon: Wifi,
    title: 'High-Speed WiFi Facility',
    description: 'Fast and reliable internet connectivity available throughout the hostel for online classes, studies, and entertainment.',
  },
  {
    icon: Droplet,
    title: 'Pure Drinking Water',
    description: 'Advanced water purifier systems provide clean, hygienic, and safe drinking water for all hostel residents.',
  },
  {
    icon: Shirt,
    title: 'Washing Machine Facility',
    description: 'Modern washing machine services available inside the hostel premises for convenient and hassle-free laundry.',
  },
  {
    icon: Fingerprint,
    title: 'Biometric & Attendance Tracking',
    description: 'Smart biometric attendance and secure entry system for better safety, monitoring, and student management.',
  },
];

export default function Index() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <BuildingBackground showOnHome={true} />
      <Navbar />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Simple Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 to-background" />

        <div className="container mx-auto px-6 pt-32 pb-20 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-5xl md:text-7xl font-bold text-foreground leading-tight"
            >
              Q2 Group of Hostels
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-xl md:text-2xl text-muted-foreground font-medium max-w-2xl mx-auto"
            >
              Smart & Digital Hostel for Girls
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex justify-center pt-8"
            >
              <Button size="lg" asChild className="px-8 text-lg rounded-full">
                <Link to="/login">Login</Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-card border-t border-border/50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Facilities Provided by Q2 Girls Hostel
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Modern amenities designed for safe, comfortable, and quality student living
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="p-6 rounded-2xl bg-background border border-border transition-all duration-300 hover:border-primary/30 hover:shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
            Join Q2 Group of Hostels Today
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="rounded-full" asChild>
              <Link to="/login">Get Started</Link>
            </Button>
            <Button variant="outline" size="lg" className="rounded-full" asChild>
              <Link to="/about">Learn More</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
