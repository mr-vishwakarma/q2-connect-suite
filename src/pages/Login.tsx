import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';
import { BuildingBackground } from '@/components/shared/BuildingBackground';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'react-toastify';
import { Eye, EyeOff, User, Building } from 'lucide-react';

export default function Login() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const { signIn, user, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      if (isAdmin) {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/student/dashboard', { replace: true });
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
    
    // Send the User ID directly as username
    const normalizedUserId = userId.trim();
    const { error } = await signIn(normalizedUserId, password, isAdminMode);
    setIsLoading(false);

    if (error) {
      toast.error('Invalid Credentials');
    } else {
      toast.success('Welcome back!');
    }
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden flex flex-col">
      <Navbar />
      
      {/* Building Background */}
      <BuildingBackground showOnHome={true} />
      
      <div className="flex-1 flex flex-col items-center justify-center w-full px-4 pt-32 pb-12 relative z-10 mt-16 md:mt-0">
        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          <Card className="w-full relative z-10 bg-card/80 backdrop-blur-xl border-border shadow-2xl">
            <CardHeader className="text-center pb-2">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4"
              >
                {isAdminMode ? <Building className="w-8 h-8 text-primary" /> : <User className="w-8 h-8 text-primary" />}
              </motion.div>
              <CardTitle className="text-2xl text-foreground font-semibold">Welcome Back</CardTitle>
              <CardDescription className="text-muted-foreground">
                Login to your Q2 Hostel account
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <Tabs defaultValue="student" onValueChange={(v) => setIsAdminMode(v === 'admin')} className="w-full mb-6 mt-2">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="student">Student</TabsTrigger>
                  <TabsTrigger value="admin">Admin</TabsTrigger>
                </TabsList>
              </Tabs>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="userId" className="text-foreground">{isAdminMode ? 'Email or Username' : 'User ID'}</Label>
                  <Input
                    id="userId"
                    type="text"
                    placeholder={isAdminMode ? 'admin@example.com' : 'Enter your User ID'}
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className="bg-background/50 border-border focus:border-primary transition-colors"
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
                      className="bg-background/50 border-border focus:border-primary pr-10 transition-colors"
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
                  <div className="flex justify-end mt-1">
                    <Link
                      to="/forgot-password"
                      className="text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      Forgot Password?
                    </Link>
                  </div>
                </div>

                <Button type="submit" className="w-full mt-4" size="lg" disabled={isLoading}>
                  {isLoading ? 'Signing in...' : `Login as ${isAdminMode ? 'Admin' : 'Student'}`}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
      
      <Footer />
    </div>
  );
}