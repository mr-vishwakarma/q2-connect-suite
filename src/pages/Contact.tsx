import { useState } from 'react';
import { motion } from 'framer-motion';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';
import { BuildingBackground } from '@/components/shared/BuildingBackground';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { AnimatedSection, TiltCard, FloatingElement, GlowButton } from '@/components/ui/animated-section';
import { 
  MapPin, 
  Phone, 
  Mail, 
  Send,
  Clock,
  Building
} from 'lucide-react';

const contactInfo = [
  {
    icon: Building,
    title: 'Hostel Address',
    lines: ['Q2 Girls Hostel', 'Plot No. 8, Manak Vihar', 'Patel Nagar, Raisen Road', 'Bhopal – 462022'],
  },
  {
    icon: Phone,
    title: 'Phone',
    lines: ['+91 9691160716'],
  },
  {
    icon: Mail,
    title: 'Email',
    lines: ['q2hostel@gmail.com'],
  },
  {
    icon: Clock,
    title: 'Office Hours (IST)',
    lines: ['Mon – Sat: 9:00 AM – 9:00 PM', 'Sunday: 9:00 AM – 2:00 PM'],
  },
];

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.phone || !formData.message) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    
    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.success('Message sent successfully! We\'ll get back to you soon.');
    setFormData({ name: '', email: '', phone: '', message: '' });
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Navbar />
      
      {/* Building Background */}
      <BuildingBackground showOnHome={true} />

      {/* Hero Section */}
      <section className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-background/90 via-card/80 to-primary/5" />
          <FloatingElement y={25} duration={10}>
            <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[150px]" />
          </FloatingElement>
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <AnimatedSection direction="up" className="max-w-3xl mx-auto text-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm mb-8"
            >
              <MapPin className="w-4 h-4" />
              <span>Contact Us</span>
            </motion.div>

            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              Get in Touch
            </h1>

            <p className="text-xl text-muted-foreground">
              Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 relative z-10">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
            {/* Contact Info - Slides from LEFT */}
            <AnimatedSection direction="left">
              <div className="space-y-6">
                <h2 className="text-3xl font-bold text-foreground mb-8">Contact Information</h2>
                
                <div className="grid gap-6">
                  {contactInfo.map((info, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -50 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1, duration: 0.5 }}
                    >
                      <TiltCard>
                        <motion.div
                          whileHover={{ 
                            x: 10,
                            boxShadow: '0 20px 40px hsl(var(--primary) / 0.15)'
                          }}
                          className="flex gap-5 p-6 rounded-2xl bg-card/90 backdrop-blur-sm border border-border/50 hover:border-primary/30 transition-all duration-300"
                        >
                          <motion.div 
                            whileHover={{ 
                              rotate: 360,
                              boxShadow: '0 0 25px hsl(var(--primary) / 0.5)'
                            }}
                            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                            className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0"
                            style={{ willChange: 'transform' }}
                          >
                            <info.icon className="w-7 h-7 text-primary" />
                          </motion.div>
                          <div>
                            <h3 className="font-bold text-foreground text-xl mb-2">{info.title}</h3>
                            {info.lines.map((line, i) => (
                              <p key={i} className="text-foreground text-lg font-semibold leading-relaxed">{line}</p>
                            ))}
                          </div>
                        </motion.div>
                      </TiltCard>
                    </motion.div>
                  ))}
                </div>
              </div>
            </AnimatedSection>

            {/* Contact Form - Slides from RIGHT */}
            <AnimatedSection direction="right" delay={0.2}>
              <motion.div 
                whileHover={{ 
                  boxShadow: '0 30px 60px hsl(var(--primary) / 0.2)',
                  borderColor: 'hsl(var(--primary) / 0.3)'
                }}
                className="p-8 rounded-3xl bg-card/90 backdrop-blur-sm border border-border/50 shadow-2xl transition-all duration-500"
              >
                <h2 className="text-2xl font-bold text-foreground mb-6">Send us a Message</h2>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 }}
                    className="space-y-2"
                  >
                    <Label htmlFor="name" className="text-foreground">Name</Label>
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="Your name"
                      value={formData.name}
                      onChange={handleChange}
                      className="bg-secondary border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      required
                    />
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 }}
                    className="space-y-2"
                  >
                    <Label htmlFor="email" className="text-foreground">
                      Email <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="your.email@example.com"
                      value={formData.email}
                      onChange={handleChange}
                      className="bg-secondary border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      required
                    />
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.45 }}
                    className="space-y-2"
                  >
                    <Label htmlFor="phone" className="text-foreground">
                      Phone Number <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="Your Phone Number"
                      value={formData.phone}
                      onChange={handleChange}
                      className="bg-secondary border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      required
                    />
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 }}
                    className="space-y-2"
                  >
                    <Label htmlFor="message" className="text-foreground">Message</Label>
                    <Textarea
                      id="message"
                      name="message"
                      placeholder="Your message..."
                      value={formData.message}
                      onChange={handleChange}
                      className="bg-secondary border-border focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[150px] transition-all"
                      required
                    />
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.6 }}
                  >
                    <GlowButton className="w-full">
                      <Button 
                        type="submit" 
                        variant="hero" 
                        size="lg" 
                        className="w-full"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          'Sending...'
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Send Message
                          </>
                        )}
                      </Button>
                    </GlowButton>
                  </motion.div>
                </form>
              </motion.div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
