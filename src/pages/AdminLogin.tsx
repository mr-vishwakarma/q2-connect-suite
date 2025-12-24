import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Eye, EyeOff, ArrowLeft, Shield } from 'lucide-react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, user, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && isAdmin) {
      navigate('/admin/dashboard');
    } else if (user && !isAdmin) {
      toast.error('You do not have admin access');
    }
  }, [user, isAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);

    if (error) {
      toast.error(error.message || 'Failed to sign in');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-hero p-6">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-slow" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-slide-up">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <Card className="glass-effect border-border/50">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-glow">
              <Shield className="w-8 h-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl text-foreground">Manager Login</CardTitle>
            <CardDescription className="text-muted-foreground">
              Sign in to your account – Manager (Q2)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@q2.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-secondary border-border focus:border-primary"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-secondary border-border focus:border-primary pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" variant="hero" className="w-full" size="lg" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign In as Manager'}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              <p>
                Student?{' '}
                <Link to="/login" className="text-primary hover:underline">
                  Student Login
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
