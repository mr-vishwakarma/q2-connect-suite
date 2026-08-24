import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin } from 'lucide-react';

export function SaaSFooter() {
  return (
    <footer className="bg-background border-t border-border/60 text-muted-foreground text-xs relative z-10">
      <div className="container mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand & Mission */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center p-1">
                <img src="/q2-logo.png" alt="Q2 Logo" className="w-full h-full object-contain" />
              </div>
              <span className="text-base font-black text-foreground">Q2 Group of Hostels</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Smart & Digital Hostel Operating Suite for student housing companies, PG chains, and independent accommodations.
            </p>
            <div className="space-y-1 pt-1 text-xs">
              <p className="flex items-center gap-2 text-foreground font-semibold">
                <Phone className="w-3.5 h-3.5 text-primary" /> +91 96911 60716
              </p>
              <p className="flex items-center gap-2 text-foreground font-semibold">
                <Mail className="w-3.5 h-3.5 text-primary" /> q2hostel@gmail.com
              </p>
            </div>
          </div>

          {/* Platform Links */}
          <div className="space-y-2">
            <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">Platform</h4>
            <ul className="space-y-1.5">
              <li><a href="#experiences" className="hover:text-primary transition-colors">Super Admin Control</a></li>
              <li><a href="#experiences" className="hover:text-primary transition-colors">Hostel Operations</a></li>
              <li><a href="#experiences" className="hover:text-primary transition-colors">Student Resident Portal</a></li>
              <li><a href="#operations" className="hover:text-primary transition-colors">Student Fee Matrix</a></li>
              <li><a href="#features" className="hover:text-primary transition-colors">Feature Catalog</a></li>
            </ul>
          </div>

          {/* Branches & Locations */}
          <div className="space-y-2">
            <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">Branches</h4>
            <ul className="space-y-2 text-xs">
              <li className="flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <span><strong>Q2 Girls Hostel (Patel Nagar):</strong> Plot No. 8, Manak Vihar, Patel Nagar, Bhopal</span>
              </li>
              <li className="flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <span><strong>Q2.0 & Q2.1 (Tech Hub):</strong> Financial District, Gachibowli, Hyderabad</span>
              </li>
            </ul>
          </div>

          {/* Access & Portals */}
          <div className="space-y-2">
            <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">Portals & Security</h4>
            <ul className="space-y-1.5">
              <li><Link to="/login?role=super_admin" className="hover:text-primary transition-colors">Super Admin Login</Link></li>
              <li><Link to="/login?role=admin" className="hover:text-primary transition-colors">Hostel Admin Sign In</Link></li>
              <li><Link to="/login?role=student" className="hover:text-primary transition-colors">Resident Portal Access</Link></li>
              <li><Link to="/about" className="hover:text-primary transition-colors">About Q2 Group</Link></li>
              <li><Link to="/contact" className="hover:text-primary transition-colors">Support & Help Desk</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <p>© {new Date().getFullYear()} Q2 Group of Hostels SaaS Platform. All rights reserved.</p>
          <div className="flex gap-4">
            <span className="text-muted-foreground hover:text-foreground cursor-pointer">Privacy Policy</span>
            <span className="text-muted-foreground hover:text-foreground cursor-pointer">Terms of Service</span>
            <span className="text-muted-foreground hover:text-foreground cursor-pointer">Security Standards</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
