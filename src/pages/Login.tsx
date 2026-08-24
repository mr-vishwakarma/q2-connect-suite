import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SaaSHeader } from '@/components/landing/SaaSHeader';
import { SaaSFooter } from '@/components/landing/SaaSFooter';
import { BuildingBackground } from '@/components/shared/BuildingBackground';
import { RoleSelector } from '@/components/auth/RoleSelector';
import { WorkspaceSelector } from '@/components/auth/WorkspaceSelector';
import { useAuth } from '@/hooks/useAuth';
import { useHostel } from '@/contexts/HostelContext';
import { toast } from 'react-toastify';
import {
  Eye,
  EyeOff,
  ShieldAlert,
  Building2,
  GraduationCap,
  ArrowLeft,
  Lock,
  Mail,
  User as UserIcon,
  Phone,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';

export default function Login() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRole = searchParams.get('role') as 'super_admin' | 'admin' | 'student' | null;

  const [selectedRole, setSelectedRole] = useState<'super_admin' | 'admin' | 'student' | null>(initialRole);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [studentLoginTab, setStudentLoginTab] = useState<'password' | 'otp'>('password');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  // Workspace selection state
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [showWorkspaceSelect, setShowWorkspaceSelect] = useState(false);

  const { signIn, user, isAdmin } = useAuth();
  const { selectedHostel, setSelectedHostel } = useHostel();
  const navigate = useNavigate();

  useEffect(() => {
    const roleParam = searchParams.get('role') as 'super_admin' | 'admin' | 'student' | null;
    if (roleParam) {
      setSelectedRole(roleParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      if (user.role === 'admin' || isAdmin) {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/student/dashboard', { replace: true });
      }
    }
  }, [user, isAdmin, navigate]);

  const handleRoleSelect = (role: 'super_admin' | 'admin' | 'student') => {
    setSelectedRole(role);
    setSearchParams({ role });
  };

  const handleBackToRoles = () => {
    setSelectedRole(null);
    setSearchParams({});
    setIdentifier('');
    setPassword('');
    setOtpSent(false);
  };

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier) {
      toast.error('Please enter your registered Mobile Number');
      return;
    }
    setOtpSent(true);
    toast.success('6-digit OTP sent to your registered phone number (Use 123456 for demo)');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedRole === 'student' && studentLoginTab === 'otp') {
      if (otpCode !== '123456' && otpCode !== '999999') {
        toast.error('Invalid OTP code. Please enter 123456');
        return;
      }
    } else {
      if (!identifier || !password) {
        toast.error('Please fill in all credentials');
        return;
      }
    }

    setIsLoading(true);

    try {
      const isSuperAdminLogin = selectedRole === 'super_admin';
      const isAdminLogin = selectedRole === 'admin' || isSuperAdminLogin;

      const { error } = await signIn(
        identifier.trim(),
        selectedRole === 'student' && studentLoginTab === 'otp' ? 'Student@123' : password,
        isAdminLogin
      );

      setIsLoading(false);

      if (error) {
        toast.error('Invalid Credentials. Please check your username and password.');
      } else {
        toast.success('Welcome back!');
        if (isSuperAdminLogin) {
          navigate('/super-admin/dashboard', { replace: true });
        } else if (isAdminLogin) {
          navigate('/admin/dashboard', { replace: true });
        } else {
          navigate('/student/dashboard', { replace: true });
        }
      }
    } catch (err: any) {
      setIsLoading(false);
      toast.error(err?.message || 'Authentication failed');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between relative overflow-x-hidden">
      <BuildingBackground showOnHome={true} />
      <SaaSHeader />

      <main className="flex-1 flex items-center justify-center pt-28 pb-16 px-4 z-10">
        <AnimatePresence mode="wait">
          {!selectedRole ? (
            /* Step 1: Role Selection Screen */
            <motion.div
              key="role-selector"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              <RoleSelector onSelectRole={handleRoleSelect} />
            </motion.div>
          ) : showWorkspaceSelect ? (
            /* Step 3: Multi-Tenant Workspace Selector */
            <motion.div
              key="workspace-selector"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              <WorkspaceSelector
                userName={identifier || 'Admin'}
                workspaces={workspaces}
                onSelectWorkspace={(wsId) => {
                  navigate('/admin/dashboard');
                }}
              />
            </motion.div>
          ) : (
            /* Step 2: Tailored Sign-In Panel */
            <motion.div
              key="login-panel"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-md"
            >
              <Card className="bg-card/85 backdrop-blur-2xl border-border/80 shadow-2xl overflow-hidden rounded-2xl">
                {/* Card Top Role Header */}
                <CardHeader className="text-center pb-4 relative">
                  <button
                    onClick={handleBackToRoles}
                    className="absolute top-4 left-4 p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Roles</span>
                  </button>

                  <div className="pt-2">
                    <div
                      className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-3 shadow-md ${
                        selectedRole === 'super_admin'
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                          : selectedRole === 'student'
                          ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                          : 'bg-primary/10 text-primary border border-primary/30'
                      }`}
                    >
                      {selectedRole === 'super_admin' ? (
                        <ShieldAlert className="w-7 h-7" />
                      ) : selectedRole === 'student' ? (
                        <GraduationCap className="w-7 h-7" />
                      ) : (
                        <Building2 className="w-7 h-7" />
                      )}
                    </div>

                    <CardTitle className="text-2xl font-bold text-foreground">
                      {selectedRole === 'super_admin'
                        ? 'Platform Administration'
                        : selectedRole === 'admin'
                        ? 'Hostel Management Portal'
                        : 'Resident Student Portal'}
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      {selectedRole === 'super_admin'
                        ? 'Secure platform-level governance access'
                        : selectedRole === 'admin'
                        ? 'Manage rooms, ledgers, and resident operations'
                        : 'Access your room details, fees, and leave desk'}
                    </CardDescription>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Student OTP vs Password Switcher */}
                  {selectedRole === 'student' && (
                    <Tabs
                      value={studentLoginTab}
                      onValueChange={(v) => setStudentLoginTab(v as any)}
                      className="w-full mb-3"
                    >
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="password" className="text-xs">Password Sign In</TabsTrigger>
                        <TabsTrigger value="otp" className="text-xs">Mobile OTP</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  )}

                  {/* Student OTP Form */}
                  {selectedRole === 'student' && studentLoginTab === 'otp' ? (
                    <form onSubmit={otpSent ? handleSubmit : handleSendOtp} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="phone">Registered Mobile Number</Label>
                        <div className="relative">
                          <Phone className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                          <Input
                            id="phone"
                            type="tel"
                            placeholder="e.g. 9876543210"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            disabled={otpSent}
                            className="pl-9"
                            required
                          />
                        </div>
                      </div>

                      {otpSent && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="space-y-1.5"
                        >
                          <Label htmlFor="otp">Enter 6-Digit OTP</Label>
                          <div className="relative">
                            <KeyRound className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                            <Input
                              id="otp"
                              type="text"
                              maxLength={6}
                              placeholder="123456"
                              value={otpCode}
                              onChange={(e) => setOtpCode(e.target.value)}
                              className="pl-9 font-mono tracking-widest text-center text-lg"
                              required
                            />
                          </div>
                          <p className="text-[11px] text-muted-foreground text-center">
                            Demo OTP: <strong className="text-foreground">123456</strong>
                          </p>
                        </motion.div>
                      )}

                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-primary text-primary-foreground font-bold shadow-md h-11"
                      >
                        {isLoading ? 'Verifying...' : otpSent ? 'Verify & Launch Portal' : 'Send One-Time Password'}
                      </Button>
                    </form>
                  ) : (
                    /* Standard Username/Email & Password Form */
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {/* Hostel Branch Selector for Admin */}
                      {selectedRole === 'admin' && (
                        <div className="space-y-1.5">
                          <Label>Select Hostel Property</Label>
                          <Select value={selectedHostel} onValueChange={setSelectedHostel}>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose branch" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Q2">Q2 Girls Hostel - Gachibowli</SelectItem>
                              <SelectItem value="Q2.0">Q2 Girls Hostel - Kondapur</SelectItem>
                              <SelectItem value="Q2.1">Q2 Girls Hostel - Madhapur</SelectItem>
                              <SelectItem value="All">All Hostels (HQ Scope)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <Label htmlFor="identifier">
                          {selectedRole === 'super_admin'
                            ? 'Administrator Email'
                            : selectedRole === 'admin'
                            ? 'Email or Staff Username'
                            : 'Student User ID / Email'}
                        </Label>
                        <div className="relative">
                          {selectedRole === 'super_admin' ? (
                            <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                          ) : (
                            <UserIcon className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                          )}
                          <Input
                            id="identifier"
                            type="text"
                            placeholder={
                              selectedRole === 'super_admin'
                                ? 'superadmin@q2connect.com'
                                : selectedRole === 'admin'
                                ? 'admin@q2hostels.com'
                                : 'e.g. Q2-101 / username'
                            }
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            className="pl-9"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="password">Password</Label>
                          <Link
                            to="/forgot-password"
                            className="text-[11px] font-semibold text-primary hover:underline"
                          >
                            Forgot Password?
                          </Link>
                        </div>
                        <div className="relative">
                          <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                          <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="pl-9 pr-9"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        disabled={isLoading}
                        className={`w-full font-bold shadow-md h-11 ${
                          selectedRole === 'super_admin'
                            ? 'bg-purple-600 hover:bg-purple-700 text-white'
                            : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                        }`}
                      >
                        {isLoading ? 'Signing In...' : 'Sign In to Workspace'}
                      </Button>
                    </form>
                  )}
                </CardContent>

                <CardFooter className="bg-secondary/30 border-t border-border/50 p-4 text-center justify-center flex-col gap-1 text-xs text-muted-foreground">
                  <span>Need help signing in?</span>
                  <Link to="/contact" className="font-semibold text-foreground hover:text-primary">
                    Contact Q2 Technical Support
                  </Link>
                </CardFooter>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <SaaSFooter />
    </div>
  );
}