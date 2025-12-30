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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Eye, EyeOff, ShieldPlus, AlertCircle } from 'lucide-react';
import { GlowButton } from '@/components/ui/animated-section';

export default function RegisterAdmin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [adminExists, setAdminExists] = useState<boolean | null>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  // Check if admin already exists
  useEffect(() => {
    const checkAdminExists = async () => {
      try {
        const { count, error } = await supabase
          .from('user_roles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'admin');
        
        if (error) {
          console.error('Error checking admin:', error);
          setAdminExists(true); // Assume admin exists on error for security
        } else {
          setAdminExists((count ?? 0) > 0);
        }
      } catch (err) {
        console.error('Error:', err);
        setAdminExists(true);
      } finally {
        setCheckingAdmin(false);
      }
    };

    checkAdminExists();
  }, []);

  // Redirect if already admin
  useEffect(() => {
    if (user && isAdmin) {
      navigate('/admin/dashboard');
    }
  }, [user, isAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password || !confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      // Create admin user with username@q2hostel.local email format
      const email = `${username.toLowerCase().trim()}@q2hostel.local`;
      
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: username },
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (signUpError) {
        toast.error(signUpError.message);
        setIsLoading(false);
        return;
      }

      if (!authData.user) {
        toast.error('Failed to create admin account');
        setIsLoading(false);
        return;
      }

      // Insert admin role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: authData.user.id, role: 'admin' });

      if (roleError) {
        toast.error('Failed to assign admin role: ' + roleError.message);
        setIsLoading(false);
        return;
      }

      toast.success('Admin account created successfully!');
      navigate('/admin-login');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create admin');
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (adminExists) {
    return (
      <div className="min-h-screen bg-background overflow-x-hidden flex flex-col">
        <Navbar />
        <BuildingBackground showOnHome={true} />
        
        <div className="flex-1 flex items-center justify-center pt-20 pb-12 px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="w-full max-w-md bg-card/60 backdrop-blur-xl border-amber-500/20 shadow-2xl">
              <CardHeader className="text-center pb-4">
                <motion.div 
                  className="w-16 h-16 rounded-2xl bg-amber-500 flex items-center justify-center mx-auto mb-4 shadow-lg"
                >
                  <AlertCircle className="w-8 h-8 text-white" />
                </motion.div>
                <CardTitle className="text-2xl text-foreground">Admin Already Exists</CardTitle>
                <CardDescription className="text-muted-foreground">
                  An admin account has already been created for this system
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <p className="text-center text-muted-foreground text-sm">
                  Please use the admin login page to access the admin panel.
                </p>
                
                <Button asChild variant="default" className="w-full">
                  <Link to="/admin-login">
                    Go to Admin Login
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
        
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden flex flex-col">
      <Navbar />
      <BuildingBackground showOnHome={true} />
      
      <div className="flex-1 flex items-center justify-start pl-12 md:pl-24 lg:pl-32 pt-20 pb-12 px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, x: -100 }}
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
                    rotate: 5,
                    boxShadow: '0 0 40px hsl(var(--primary) / 0.5)'
                  }}
                  className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/25"
                >
                  <ShieldPlus className="w-8 h-8 text-primary-foreground" />
                </motion.div>
                <CardTitle className="text-2xl text-foreground">Create First Admin</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Set up the admin account for Q2 Management
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
                    <Label htmlFor="username" className="text-foreground">Admin Username</Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder="admin"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
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
                    className="space-y-2"
                  >
                    <Label htmlFor="confirmPassword" className="text-foreground">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="bg-secondary border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      required
                    />
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                  >
                    <GlowButton className="w-full">
                      <Button type="submit" variant="hero" className="w-full" size="lg" disabled={isLoading}>
                        {isLoading ? 'Creating Admin...' : 'Create Admin Account'}
                      </Button>
                    </GlowButton>
                  </motion.div>
                </form>

                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="mt-6 pt-6 border-t border-border/50 text-center text-sm text-muted-foreground"
                >
                  <p>Already have an admin account?</p>
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
