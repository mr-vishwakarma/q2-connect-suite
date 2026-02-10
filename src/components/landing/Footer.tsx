import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Facebook, Twitter, Instagram, Linkedin } from 'lucide-react';

const footerLinks = [
  { name: 'Home', path: '/' },
  { name: 'About Us', path: '/about' },
  { name: 'Contact Us', path: '/contact' },
  { name: 'Admin Login', path: '/admin-login' },
  { name: 'User Login', path: '/login' },
];

const socialLinks = [
  { icon: Facebook, href: '#' },
  { icon: Twitter, href: '#' },
  { icon: Instagram, href: '#' },
  { icon: Linkedin, href: '#' },
];

export function Footer() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <motion.footer 
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      className="bg-gradient-to-b from-card to-background border-t border-border relative z-10"
    >
      <div className="container mx-auto px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left - Logo, Description & Address */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="space-y-4"
          >
            <Link to="/" className="flex items-center gap-3 group">
              <motion.div 
                whileHover={{ 
                  scale: 1.1,
                  boxShadow: '0 0 30px hsl(var(--primary) / 0.5)'
                }}
                className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25"
              >
                <span className="text-primary-foreground font-bold text-lg">Q2</span>
              </motion.div>
              <span className="text-foreground font-bold text-xl">Q2 Management</span>
            </Link>
            <p className="text-foreground font-bold text-base">
              Q2 Management – Smart Hostel Management System for modern hostels and student accommodations.
            </p>
            
            {/* Hostel Address */}
            <div className="pt-4 space-y-1">
              <p className="text-foreground font-bold text-sm" style={{ textShadow: '0 0 10px rgba(255, 255, 255, 0.2)' }}>Hostel Address</p>
              <p className="text-foreground font-bold text-sm" style={{ textShadow: '0 0 10px rgba(255, 255, 255, 0.2)' }}>Q2 Hostel</p>
              <p className="text-foreground font-bold text-sm" style={{ textShadow: '0 0 10px rgba(255, 255, 255, 0.2)' }}>Sector E-8 Campus</p>
              <p className="text-foreground font-bold text-sm" style={{ textShadow: '0 0 10px rgba(255, 255, 255, 0.2)' }}>Patel Nagar, Bhopal</p>
              <p className="text-foreground font-bold text-sm" style={{ textShadow: '0 0 10px rgba(255, 255, 255, 0.2)' }}>Madhya Pradesh – 462022</p>
            </div>
          </motion.div>

          {/* Middle - Links */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="space-y-4"
          >
            <h4 className="text-foreground font-semibold">Quick Links</h4>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {footerLinks.map((link, index) => (
                <motion.div
                  key={link.path}
                  initial={{ opacity: 0, y: 10 }}
                  animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                  transition={{ delay: 0.4 + index * 0.05, duration: 0.3 }}
                >
                  <Link
                    to={link.path}
                    className="text-foreground font-bold text-sm hover:text-primary transition-colors relative group"
                    style={{ textShadow: '0 0 10px rgba(255, 255, 255, 0.2)' }}
                  >
                    {link.name}
                    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full" />
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right - Social */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="space-y-4"
          >
            <h4 className="text-foreground font-semibold">Connect With Us</h4>
            <div className="flex gap-4">
                {socialLinks.map((social, index) => (
                <motion.a
                  key={index}
                  href={social.href}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
                  transition={{ delay: 0.5 + index * 0.08, type: 'spring', stiffness: 300 }}
                  whileHover={{ 
                    scale: 1.15,
                    rotate: 360,
                    boxShadow: '0 0 25px hsl(var(--primary) / 0.5)',
                    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] }
                  }}
                  whileTap={{ scale: 0.9 }}
                  className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/15 transition-all duration-200"
                  style={{ willChange: 'transform' }}
                >
                  <social.icon className="w-5 h-5" />
                </motion.a>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Copyright */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="mt-6 pt-4 border-t border-border/50 text-center"
        >
          <p className="text-foreground font-bold text-sm" style={{ textShadow: '0 0 10px rgba(255, 255, 255, 0.2)' }}>
            © 2025 Q2 Management. All rights reserved.
          </p>
        </motion.div>
      </div>
    </motion.footer>
  );
}
