import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function LandingNavbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-effect">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
              <span className="text-primary-foreground font-bold text-lg">Q2</span>
            </div>
            <span className="text-foreground font-semibold text-xl hidden sm:block">
              Q2 Management
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link to="/about" className="text-muted-foreground hover:text-foreground transition-colors">
              About
            </Link>
            <Link to="/contact" className="text-muted-foreground hover:text-foreground transition-colors">
              Contact
            </Link>
            <Link to="/request-registration" className="text-muted-foreground hover:text-foreground transition-colors">
              Request
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link to="/admin-login">Admin Login</Link>
            </Button>
            <Button variant="hero" asChild>
              <Link to="/login">Login</Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
