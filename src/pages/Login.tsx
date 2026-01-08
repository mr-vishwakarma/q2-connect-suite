import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';
import { BuildingBackground } from '@/components/shared/BuildingBackground';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Eye, EyeOff, User, Building } from 'lucide-react';
import { GlowButton } from '@/components/ui/animated-section';

export default function Login() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, user, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      if (isAdmin) {
        navigate('/admin/dashboard');
      } else {
        navigate('/student/dashboard');
      }
    }
  }, [user, isAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userId || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    
    // Normalize User ID - remove @ and everything after if present, then convert to email format
    const normalizedUserId = userId.toLowerCase().split('@')[0].trim();
    const email = `${normalizedUserId}@q2student.local`;
    const { error } = await signIn(email, password);
    setIsLoading(false);

    if (error) {
      toast.error('Invalid User ID or Password');
    } else {
      toast.success('Welcome back!');
    }
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden flex flex-col">
      <Navbar />
      
      {/* Building Background */}
      <BuildingBackground showOnHome={true} />
      
      <div className="flex-1 flex items-center justify-start pl-12 md:pl-24 lg:pl-32 pt-20 pb-12 px-6 relative z-10">
        {/* Card - Slides from RIGHT */}
        <motion.div
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <motion.div
            whileHover={{ 
              boxShadow: '0 0 60px hsl(var(--primary) / 0.3)',
              borderColor: 'hsl(var(--primary) / 0.4)'
            }}
            transition={{ duration: 0.3 }}
          >
            <Card className="w-full max-w-md relative z-10 bg-card/60 backdrop-blur-xl border-primary/20 shadow-2xl shadow-primary/10">
              <CardHeader className="text-center pb-4">
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
                  whileHover={{ 
                    scale: 1.1,
                    boxShadow: '0 0 40px hsl(var(--primary) / 0.5)'
                  }}
                  className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/25"
                >
                  <User className="w-8 h-8 text-primary-foreground" />
                </motion.div>
                <CardTitle className="text-2xl text-foreground">Student Login</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Q2 Hostel
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="space-y-2"
                  >
                    <Label htmlFor="userId" className="text-foreground">User ID</Label>
                    <Input
                      id="userId"
                      type="text"
                      placeholder="Enter your User ID"
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      className="bg-secondary border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      required
                    />
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="space-y-2"
                  >
                    <Label htmlFor="password" className="text-foreground">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="bg-secondary border-border focus:border-primary focus:ring-2 focus:ring-primary/20 pr-10 transition-all"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                  >
                    <GlowButton className="w-full">
                      <Button type="submit" variant="hero" className="w-full" size="lg" disabled={isLoading}>
                        {isLoading ? 'Signing in...' : 'Login'}
                      </Button>
                    </GlowButton>
                  </motion.div>
                </form>

                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="mt-6 pt-6 border-t border-border/50 text-center text-sm text-muted-foreground"
                >
                  <p className="flex items-center justify-center gap-2">
                    <Building className="w-4 h-4" />
                    Are you an administrator?
                  </p>
                  <Link to="/admin-login" className="text-primary hover:underline mt-1 inline-block hover:text-primary/80 transition-colors">
                    Admin Login
                  </Link>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
      
      <Footer />
    </div>
  );
}