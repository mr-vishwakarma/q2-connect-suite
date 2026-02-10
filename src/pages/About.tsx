import { motion } from 'framer-motion';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';
import { BuildingBackground } from '@/components/shared/BuildingBackground';
import { AnimatedSection, TiltCard, StaggerContainer, StaggerItem, FloatingElement } from '@/components/ui/animated-section';
import { 
  Target, 
  Users, 
  Clock, 
  Shield, 
  Zap,
  Heart,
  GraduationCap,
  DollarSign,
  Building
} from 'lucide-react';

const trustStats = [
  { icon: Users, value: '100+', label: 'Students' },
  { icon: Clock, value: '24/7', label: 'Access' },
  { icon: Shield, value: 'Secure', label: 'Management' },
  { icon: Zap, value: 'Faster', label: 'Operations' },
];

const values = [
  {
    icon: Shield,
    title: 'Student Safety',
    description: 'Ensuring a secure living environment for all residents.',
  },
  {
    icon: Heart,
    title: 'Equal Facilities',
    description: 'Providing equal access to all amenities and services.',
  },
  {
    icon: GraduationCap,
    title: 'Education Support',
    description: 'Creating an environment conducive to academic success.',
  },
  {
    icon: DollarSign,
    title: 'Affordable Living',
    description: 'Maintaining reasonable costs without compromising quality.',
  },
];

export default function About() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Navbar />
      
      {/* Building Background */}
      <BuildingBackground showOnHome={true} />

      {/* Hero Section - Slides from RIGHT */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-background/90 via-card/80 to-primary/5" />
          <FloatingElement y={30} duration={10}>
            <div className="absolute top-1/3 left-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px]" />
          </FloatingElement>
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Text - Slides from RIGHT */}
            <AnimatedSection direction="right" className="max-w-2xl">
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm mb-8"
              >
                <Target className="w-4 h-4" />
                <span>About Us</span>
              </motion.div>

              <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
                Our Mission
              </h1>

              <p className="text-xl md:text-2xl text-foreground font-bold leading-relaxed" style={{ textShadow: '0 0 15px rgba(255, 255, 255, 0.25)' }}>
                We empower Q2 Hostel to embrace digital transformation by simplifying hostel administration and student services.
              </p>
            </AnimatedSection>

            {/* Illustration - Slides from LEFT */}
            <AnimatedSection direction="left" delay={0.2}>
              <div className="relative">
                <FloatingElement y={15} duration={6}>
                  <div className="p-8 rounded-3xl bg-gradient-to-br from-primary/20 via-card to-info/10 border border-border/50 backdrop-blur-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <TiltCard>
                        <div className="p-6 rounded-2xl bg-card/80 border border-border/30">
                          <Building className="w-10 h-10 text-primary mb-3" />
                          <div className="text-2xl font-bold text-foreground">Q2</div>
                          <div className="text-sm text-foreground font-bold" style={{ textShadow: '0 0 8px rgba(255, 255, 255, 0.2)' }}>Hostel</div>
                        </div>
                      </TiltCard>
                      <TiltCard>
                        <div className="p-6 rounded-2xl bg-card/80 border border-border/30">
                          <Shield className="w-10 h-10 text-primary mb-3" />
                          <div className="text-2xl font-bold text-foreground">100%</div>
                          <div className="text-sm text-foreground font-bold" style={{ textShadow: '0 0 8px rgba(255, 255, 255, 0.2)' }}>Secure</div>
                        </div>
                      </TiltCard>
                    </div>
                  </div>
                </FloatingElement>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Trust Section - Fades + Scales */}
      <section className="py-24 bg-card/50 relative z-10">
        <div className="container mx-auto px-6">
          <AnimatedSection direction="scale" className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Trusted by Students & Administrators
            </h2>
            <p className="text-foreground font-bold text-lg" style={{ textShadow: '0 0 12px rgba(255, 255, 255, 0.25)' }}>
              at Q2 Hostel
            </p>
          </AnimatedSection>

          <StaggerContainer className="grid grid-cols-2 lg:grid-cols-4 gap-6" staggerDelay={0.15}>
            {trustStats.map((stat, index) => (
              <StaggerItem key={index}>
                <TiltCard>
                  <motion.div
                    whileHover={{ 
                      y: -5,
                      boxShadow: '0 20px 40px hsl(var(--primary) / 0.15)'
                    }}
                    className="p-8 rounded-2xl bg-card border border-border/50 text-center hover:border-primary/30 transition-all duration-300 group"
                  >
                    <motion.div 
                      whileHover={{ rotate: 360, scale: 1.1 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 group-hover:shadow-lg group-hover:shadow-primary/30 transition-all"
                      style={{ willChange: 'transform' }}
                    >
                      <stat.icon className="w-7 h-7 text-primary" />
                    </motion.div>
                    <div className="text-3xl font-bold text-foreground mb-1">{stat.value}</div>
                    <div className="text-foreground font-bold text-sm" style={{ textShadow: '0 0 8px rgba(255, 255, 255, 0.2)' }}>{stat.label}</div>
                  </motion.div>
                </TiltCard>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Team Section - Alternating slides */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <FloatingElement y={-20} duration={12}>
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-info/5 rounded-full blur-[120px]" />
          </FloatingElement>
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Text - Slides from LEFT */}
            <AnimatedSection direction="left">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Built for Students.
                <span className="block text-primary">Managed with Care.</span>
              </h2>

              <p className="text-foreground font-bold text-lg mb-6 leading-relaxed" style={{ textShadow: '0 0 12px rgba(255, 255, 255, 0.25)' }}>
                Q2 Management directly improves hostel life, making administration simple and transparent for everyone involved.
              </p>

              <p className="text-foreground font-bold leading-relaxed" style={{ textShadow: '0 0 10px rgba(255, 255, 255, 0.2)' }}>
                Our system streamlines every aspect of hostel management, from room allocation to mess management, ensuring that both students and administrators can focus on what matters most – creating a comfortable and productive living environment.
              </p>
            </AnimatedSection>

            {/* Cards - Slides from RIGHT */}
            <AnimatedSection direction="right" delay={0.2}>
              <div className="relative">
                <div className="p-8 rounded-3xl bg-gradient-to-br from-primary/10 via-card to-info/10 border border-border/50">
                  <StaggerContainer className="grid grid-cols-2 gap-4" staggerDelay={0.1}>
                    {[
                      { icon: Building, label: 'Modern', value: 'Infrastructure' },
                      { icon: Users, label: 'Dedicated', value: 'Support Team' },
                      { icon: Shield, label: '24/7', value: 'Security' },
                      { icon: Zap, label: 'Quick', value: 'Response Time' },
                    ].map((item, index) => (
                      <StaggerItem key={index}>
                        <TiltCard>
                          <div className="p-6 rounded-2xl bg-card/80 border border-border/30 hover:border-primary/30 transition-all">
                            <motion.div
                              whileHover={{ scale: 1.2, rotate: -10 }}
                              transition={{ type: 'spring', stiffness: 300 }}
                            >
                              <item.icon className="w-8 h-8 text-primary mb-3" />
                            </motion.div>
                            <div className="text-sm text-foreground font-bold" style={{ textShadow: '0 0 8px rgba(255, 255, 255, 0.2)' }}>{item.label}</div>
                            <div className="text-lg font-semibold text-foreground">{item.value}</div>
                          </div>
                        </TiltCard>
                      </StaggerItem>
                    ))}
                  </StaggerContainer>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Values Section - Slides from RIGHT */}
      <section className="py-24 bg-card/50 relative z-10">
        <div className="container mx-auto px-6">
          <AnimatedSection direction="right" className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Our Values
            </h2>
            <p className="text-foreground font-bold text-lg max-w-2xl mx-auto" style={{ textShadow: '0 0 12px rgba(255, 255, 255, 0.25)' }}>
              The principles that guide everything we do at Q2 Hostel
            </p>
          </AnimatedSection>

          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" staggerDelay={0.15}>
            {values.map((value, index) => (
              <StaggerItem key={index}>
                <TiltCard>
                  <motion.div
                    whileHover={{ 
                      y: -8,
                      boxShadow: '0 25px 50px hsl(var(--primary) / 0.2)'
                    }}
                    className="p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-all duration-300 group text-center h-full"
                  >
                    <motion.div 
                      whileHover={{ 
                        scale: 1.2,
                        boxShadow: '0 0 30px hsl(var(--primary) / 0.5)'
                      }}
                      className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-all"
                    >
                      <value.icon className="w-7 h-7 text-primary" />
                    </motion.div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{value.title}</h3>
                    <p className="text-foreground font-bold text-sm" style={{ textShadow: '0 0 8px rgba(255, 255, 255, 0.2)' }}>{value.description}</p>
                  </motion.div>
                </TiltCard>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      <Footer />
    </div>
  );
}
