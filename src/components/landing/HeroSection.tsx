import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, LayoutDashboard, Users, MessageSquare } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="min-h-screen flex items-center justify-center gradient-hero relative overflow-hidden pt-20">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left content */}
          <div className="animate-slide-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-effect mb-6">
              <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
              <span className="text-sm text-muted-foreground">All-in-one Management Platform</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              <span className="text-foreground">Q2 Management</span>
              <br />
              <span className="text-gradient">System</span>
            </h1>

            <p className="text-xl text-muted-foreground mb-8 max-w-lg">
              One Solution For All Of Q2's Management Needs. Streamline student management, 
              mess operations, and administrative tasks.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button variant="hero" size="xl" asChild>
                <Link to="/login" className="group">
                  Login
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button variant="glass" size="xl" asChild>
                <Link to="/request-registration">
                  Request Registration
                </Link>
              </Button>
            </div>
          </div>

          {/* Right illustration */}
          <div className="hidden lg:block animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <div className="relative">
              {/* Dashboard mockup */}
              <div className="glass-effect rounded-2xl p-6 shadow-elevated animate-float">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-destructive" />
                  <div className="w-3 h-3 rounded-full bg-warning" />
                  <div className="w-3 h-3 rounded-full bg-success" />
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                      <LayoutDashboard className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="h-3 bg-secondary rounded w-3/4 mb-2" />
                      <div className="h-2 bg-muted rounded w-1/2" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-secondary rounded-xl p-4 text-center">
                      <Users className="w-6 h-6 text-primary mx-auto mb-2" />
                      <div className="text-2xl font-bold text-foreground">156</div>
                      <div className="text-xs text-muted-foreground">Students</div>
                    </div>
                    <div className="bg-secondary rounded-xl p-4 text-center">
                      <MessageSquare className="w-6 h-6 text-success mx-auto mb-2" />
                      <div className="text-2xl font-bold text-foreground">24</div>
                      <div className="text-xs text-muted-foreground">Requests</div>
                    </div>
                    <div className="bg-secondary rounded-xl p-4 text-center">
                      <div className="w-6 h-6 rounded-full bg-warning/20 flex items-center justify-center mx-auto mb-2">
                        <span className="text-warning text-xs font-bold">!</span>
                      </div>
                      <div className="text-2xl font-bold text-foreground">8</div>
                      <div className="text-xs text-muted-foreground">Complaints</div>
                    </div>
                  </div>

                  <div className="h-24 bg-secondary rounded-xl flex items-end p-4 gap-2">
                    {[40, 65, 45, 80, 55, 70, 60].map((height, i) => (
                      <div
                        key={i}
                        className="flex-1 gradient-primary rounded-t"
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating card */}
              <div className="absolute -bottom-8 -left-8 glass-effect rounded-xl p-4 shadow-card animate-float" style={{ animationDelay: '1s' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center">
                    <span className="text-sm font-bold text-primary-foreground">✓</span>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">Request Approved</div>
                    <div className="text-xs text-muted-foreground">Mess off granted</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
