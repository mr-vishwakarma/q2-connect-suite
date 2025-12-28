import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';
import { BuildingBackground } from '@/components/shared/BuildingBackground';
import { AnimatedSection, TiltCard, StaggerContainer, StaggerItem, FloatingElement, GlowButton } from '@/components/ui/animated-section';
import {
  Users, 
  UtensilsCrossed, 
  MessageSquare, 
  ClipboardCheck, 
  Shield,
  Building,
} from 'lucide-react';

const features = [
  {
    icon: Users,
    title: 'Student Management',
    description: 'Complete student database with room allocation and profile management.',
  },
  {
    icon: UtensilsCrossed,
    title: 'Mess Management',
    description: 'Track mess attendance, manage mess off requests, and meal planning.',
  },
  {
    icon: MessageSquare,
    title: 'Complaint Handling',
    description: 'Streamlined complaint submission and resolution tracking system.',
  },
  {
    icon: ClipboardCheck,
    title: 'Attendance Tracking',
    description: 'Real-time attendance monitoring with detailed reports.',
  },
  {
    icon: Shield,
    title: 'Secure Access',
    description: 'Role-based authentication for students and administrators.',
  },
  {
    icon: Building,
    title: 'Room Management',
    description: 'Efficient room allocation and vacancy management system.',
  },
];


export default function Index() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <BuildingBackground showOnHome={true} />
      <Navbar />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Animated Background Elements - Reduced darkness for building visibility */}
        <div className="absolute inset-0">
          <motion.div 
            className="absolute inset-0 bg-gradient-to-br from-background/20 via-transparent to-primary/5"
            animate={{ 
              background: [
                'linear-gradient(135deg, hsl(222 47% 6% / 0.2) 0%, transparent 50%, hsl(217 91% 60% / 0.05) 100%)',
                'linear-gradient(135deg, hsl(222 47% 6% / 0.15) 0%, transparent 40%, hsl(217 91% 60% / 0.08) 100%)',
                'linear-gradient(135deg, hsl(222 47% 6% / 0.2) 0%, transparent 50%, hsl(217 91% 60% / 0.05) 100%)',
              ]
            }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
          
          <FloatingElement y={30} duration={8}>
            <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px]" />
          </FloatingElement>
          
          <FloatingElement y={-25} duration={10}>
            <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-info/10 rounded-full blur-[100px]" />
          </FloatingElement>

          {/* Floating shapes for 3D illusion */}
          <FloatingElement y={40} duration={7} className="absolute top-1/3 right-[15%]">
            <div className="w-20 h-20 rounded-2xl bg-primary/20 rotate-45 blur-sm" />
          </FloatingElement>
          
          <FloatingElement y={-35} duration={9} className="absolute bottom-1/3 left-[10%]">
            <div className="w-16 h-16 rounded-full bg-info/15 blur-sm" />
          </FloatingElement>
        </div>

        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

        <div className="container mx-auto px-6 pt-32 pb-20 relative z-10">
          <div className="max-w-4xl mx-auto text-center">

            <motion.h1 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="text-5xl md:text-7xl font-extrabold mb-6 leading-tight"
              style={{ 
                color: 'hsl(217 91% 35%)',
                textShadow: '0 4px 20px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,1)'
              }}
            >
              Q2 Hostel Management
              <motion.span 
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, delay: 0.3 }}
                className="block"
                style={{ 
                  color: 'hsl(217 91% 35%)',
                  textShadow: '0 4px 20px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,1)'
                }}
              >
                System
              </motion.span>
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto"
            >
              Smart & Digital Hostel Management for Q2 Hostel
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <GlowButton>
                <Button variant="hero" size="xl" asChild>
                  <Link to="/login">User Login</Link>
                </Button>
              </GlowButton>
              <GlowButton>
                <Button variant="glass" size="xl" asChild>
                  <Link to="/admin-login">Admin Login</Link>
                </Button>
              </GlowButton>
            </motion.div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, 10, 0] }}
          transition={{ 
            opacity: { delay: 1, duration: 0.5 },
            y: { delay: 1, duration: 1.5, repeat: Infinity }
          }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2">
            <motion.div 
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-1 h-2 rounded-full bg-muted-foreground/50" 
            />
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-card/30 backdrop-blur-sm">
        <div className="container mx-auto px-6">
          <AnimatedSection direction="up" className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 drop-shadow-lg" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
              Comprehensive Hostel Management
            </h2>
            <p className="text-foreground font-semibold text-lg max-w-2xl mx-auto drop-shadow-md" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.4)' }}>
              Everything you need to manage your hostel efficiently in one platform
            </p>
          </AnimatedSection>

          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" staggerDelay={0.15}>
            {features.map((feature, index) => (
              <StaggerItem key={index}>
                <TiltCard className="h-full">
                  <div className="p-6 rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 hover:border-primary/30 transition-all duration-300 group hover:shadow-xl hover:shadow-primary/10 h-full">
                    <motion.div 
                      whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                      transition={{ duration: 0.4 }}
                      className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 group-hover:shadow-lg group-hover:shadow-primary/20 transition-all"
                    >
                      <feature.icon className="w-6 h-6 text-primary" />
                    </motion.div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                    <p className="text-foreground/90 font-medium text-sm">{feature.description}</p>
                  </div>
                </TiltCard>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>


      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-primary/10 via-primary/5 to-info/10 relative overflow-hidden">
        <FloatingElement y={20} duration={8} className="absolute top-10 left-10">
          <div className="w-32 h-32 rounded-full bg-primary/10 blur-2xl" />
        </FloatingElement>
        <FloatingElement y={-15} duration={6} className="absolute bottom-10 right-10">
          <div className="w-24 h-24 rounded-full bg-info/10 blur-2xl" />
        </FloatingElement>

        <div className="container mx-auto px-6 text-center relative z-10">
          <AnimatedSection direction="up">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              Ready to Get Started?
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
              Join Q2 Hostel's digital management system today
            </p>
            <motion.div 
              className="flex flex-col sm:flex-row gap-4 justify-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
            >
              <GlowButton>
                <Button variant="hero" size="lg" asChild>
                  <Link to="/login">Get Started</Link>
                </Button>
              </GlowButton>
              <Button variant="ghost" size="lg" asChild>
                <Link to="/about">Learn More</Link>
              </Button>
            </motion.div>
          </AnimatedSection>
        </div>
      </section>

      <Footer />
    </div>
  );
}
