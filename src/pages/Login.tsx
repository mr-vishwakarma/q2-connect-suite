import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleLogin } from '@react-oauth/google';
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
  AlertTriangle,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { GoogleStep2Modal } from '@/components/auth/GoogleStep2Modal';

export default function Login() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRole = searchParams.get('role') as 'super_admin' | 'admin' | 'student' | null;

  const [selectedRole, setSelectedRole] = useState<'super_admin' | 'admin' | 'student' | null>(initialRole);
  const [isRegistering, setIsRegistering] = useState(false);

  // Google Step 2 Completion State
  const [showGoogleStep2, setShowGoogleStep2] = useState(false);
  const [googleSetupToken, setGoogleSetupToken] = useState('');
  const [googleProfileData, setGoogleProfileData] = useState<any>(null);

  // Sign In credentials
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Student Registration fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regHostel, setRegHostel] = useState('Q2');

  // Account Lockout / Security State
  const [lockoutInfo, setLockoutInfo] = useState<{
    isLocked?: boolean;
    lockMinutes?: number;
    remainingAttempts?: number;
    message?: string;
  } | null>(null);

  // Workspace selection state
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [showWorkspaceSelect, setShowWorkspaceSelect] = useState(false);

  const { signIn, signInWithGoogle, signUp, user, isAdmin } = useAuth();
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
      if (user.role === 'super_admin' || user.isSuperAdmin) {
        navigate('/super-admin/dashboard', { replace: true });
      } else if (user.role === 'admin' || isAdmin) {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/student/dashboard', { replace: true });
      }
    }
  }, [user, isAdmin, navigate]);

  const handleRoleSelect = (role: 'super_admin' | 'admin' | 'student') => {
    setSelectedRole(role);
    setSearchParams({ role });
    setLockoutInfo(null);
  };

  const handleBackToRoles = () => {
    setSelectedRole(null);
    setSearchParams({});
    setIdentifier('');
    setPassword('');
    setIsRegistering(false);
    setLockoutInfo(null);
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (!credentialResponse?.credential) {
      toast.error('Google Sign In did not return a credential.');
      return;
    }

    setIsLoading(true);
    setLockoutInfo(null);

    try {
      const result = await signInWithGoogle(credentialResponse.credential);
      setIsLoading(false);

      if (result.error) {
        toast.error(result.error.message || 'Google authentication failed');
        return;
      }

      // If new resident requires Step 2 username, password, and hostel setup
      if (result.requiresProfileSetup) {
        setGoogleSetupToken(result.setupToken || '');
        setGoogleProfileData(result.googleProfile);
        setShowGoogleStep2(true);
        toast.info('Google account verified! Please set up your username and password.');
        return;
      }

      const loggedUser = result.user;
      toast.success(`Welcome ${loggedUser?.name || 'back'}! (Authenticated via Google)`);
      if (loggedUser?.role === 'super_admin' || loggedUser?.isSuperAdmin) {
        navigate('/super-admin/dashboard', { replace: true });
      } else if (loggedUser?.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/student/dashboard', { replace: true });
      }
    } catch (err: any) {
      setIsLoading(false);
      toast.error(err?.message || 'Google authentication failed');
    }
  };

  const activeGoogleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || import.meta.env.GOOGLE_CLIENT_ID || '').trim();
  const hasValidGoogleClientId = Boolean(
    activeGoogleClientId &&
    activeGoogleClientId.length > 15 &&
    !activeGoogleClientId.includes('not-configured') &&
    !activeGoogleClientId.includes('demo')
  );

  // Demo Google Login fallback for local dev when Google Client ID is not configured
  const handleDemoGoogleLogin = async () => {
    let emailToUse = identifier?.includes('@') ? identifier.trim() : '';
    if (!emailToUse) {
      emailToUse = window.prompt(
        'Notice: VITE_GOOGLE_CLIENT_ID is not configured in .env.\nEnter your Google email to test Sign-In & Step 2 Setup:',
        'priya.resident@gmail.com'
      ) || '';
    }
    if (!emailToUse.trim()) return;

    // Construct a development mock Google JWT payload
    const normalizedEmail = emailToUse.toLowerCase().trim();
    const mockPayload = {
      sub: `google_oauth_dev_${Date.now()}`,
      email: normalizedEmail,
      email_verified: true,
      name: normalizedEmail.split('@')[0],
      picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    };
    const mockToken = `mockHeader.${btoa(JSON.stringify(mockPayload))}.mockSignature`;
    await handleGoogleSuccess({ credential: mockToken });
  };

  const renderGoogleButton = (buttonText: string = 'Continue with Google') => {
    return (
      <div className="w-full">
        {hasValidGoogleClientId ? (
          <div className="flex justify-center w-full [&>div]:!w-full [&>div>iframe]:!w-full">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => toast.error('Google Sign In failed. Please check Google Console configuration.')}
              theme="outline"
              size="large"
              shape="rectangular"
              text={isRegistering ? 'signup_with' : 'continue_with'}
              width="100%"
            />
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={handleDemoGoogleLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl border border-border/80 bg-card hover:bg-secondary/60 text-xs font-semibold text-foreground transition-all shadow-sm group"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{buttonText}</span>
            </button>
            <p className="text-[10px] text-muted-foreground text-center mt-1.5">
              💡 Notice: Add your real Google Client ID to <code className="text-foreground">.env</code> to activate live Google popup.
            </p>
          </div>
        )}
      </div>
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!identifier || !password) {
      toast.error('Please enter your credentials');
      return;
    }

    setIsLoading(true);

    try {
      const isSuperAdminLogin = selectedRole === 'super_admin';
      const isAdminLogin = selectedRole === 'admin' || isSuperAdminLogin;

      const { error, user: loggedUser } = await signIn(
        identifier.trim(),
        password,
        isAdminLogin
      );

      setIsLoading(false);

      if (error) {
        if (error.isLocked) {
          setLockoutInfo({
            isLocked: true,
            lockMinutes: error.lockMinutes || 15,
            message: error.message,
          });
        } else if (error.remainingAttempts !== undefined) {
          setLockoutInfo({
            remainingAttempts: error.remainingAttempts,
            message: error.message,
          });
        }
        toast.error(error.message || 'Invalid Credentials. Please check your username and password.');
      } else {
        setLockoutInfo(null);
        toast.success('Welcome back!');
        if (isSuperAdminLogin || loggedUser?.role === 'super_admin' || loggedUser?.isSuperAdmin) {
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

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regEmail || !regPassword) {
      toast.error('Please fill in Name, Email, and Password');
      return;
    }
    if (regPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);
    try {
      const { error, user: loggedUser } = await signUp({
        name: regName,
        email: regEmail,
        username: regUsername || regEmail.split('@')[0],
        phone: regPhone,
        password: regPassword,
        hostel: regHostel,
        role: 'student',
      });

      setIsLoading(false);
      if (error) {
        toast.error(error.message || 'Registration failed');
      } else {
        toast.success('Resident account created successfully! Welcome to Q2.');
        navigate('/student/dashboard', { replace: true });
      }
    } catch (err: any) {
      setIsLoading(false);
      toast.error(err?.message || 'Registration failed');
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
                onSelectWorkspace={() => {
                  navigate('/admin/dashboard');
                }}
              />
            </motion.div>
          ) : (
            /* Step 2: Tailored Sign-In / Registration Panel */
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
                        : isRegistering
                        ? 'Create Resident Account'
                        : 'Resident Student Portal'}
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      {selectedRole === 'super_admin'
                        ? 'Secure platform-level governance access'
                        : selectedRole === 'admin'
                        ? 'Manage rooms, ledgers, and resident operations'
                        : isRegistering
                        ? 'Register as a new student resident in Q2 Hostels'
                        : 'Access your room details, fees, and gate passes'}
                    </CardDescription>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Account Lockout Security Alert */}
                  {lockoutInfo?.isLocked && (
                    <div className="p-3.5 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs space-y-1.5 animate-in fade-in slide-in-from-top-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-destructive" />
                        <span>Account Temporarily Locked (Anti-Brute Force Protection)</span>
                      </div>
                      <p className="leading-relaxed">{lockoutInfo.message}</p>
                      <div className="pt-1 text-[11px] font-medium opacity-90">
                        ⚡ Tip: If you own this email, you can log in immediately via <strong>Google Sign-In</strong> or reset your password.
                      </div>
                    </div>
                  )}

                  {/* Failed Attempt Warning Banner */}
                  {!lockoutInfo?.isLocked && lockoutInfo?.remainingAttempts !== undefined && (
                    <div className="p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-500 text-xs flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span>{lockoutInfo.message}</span>
                    </div>
                  )}

                  {/* Student Mode Switcher: Sign In vs Register */}
                  {selectedRole === 'student' && (
                    <div className="flex rounded-xl bg-secondary/60 p-1 border border-border/40 mb-3">
                      <button
                        type="button"
                        onClick={() => { setIsRegistering(false); setLockoutInfo(null); }}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                          !isRegistering ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Sign In
                      </button>
                      <button
                        type="button"
                        onClick={() => { setIsRegistering(true); setLockoutInfo(null); }}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                          isRegistering ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        New Resident (Sign Up)
                      </button>
                    </div>
                  )}

                  {/* REGISTRATION FORM FOR STUDENTS */}
                  {selectedRole === 'student' && isRegistering ? (
                    <div className="space-y-4">
                      {/* 1-Click Fast Google Registration */}
                      <div className="space-y-1.5">
                        {renderGoogleButton('1-Click Sign Up with Google')}
                        <p className="text-[11px] text-muted-foreground text-center">
                          ⚡ Instant email verification. You configure username & password in Step 2.
                        </p>
                      </div>

                      <div className="relative my-3">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-border/60" />
                        </div>
                        <div className="relative flex justify-center text-[10px] uppercase">
                          <span className="bg-card px-2.5 text-muted-foreground font-semibold">
                            Or Register Manually
                          </span>
                        </div>
                      </div>

                      {/* Manual Registration Form */}
                      <form onSubmit={handleRegisterSubmit} className="space-y-3">
                        <div className="space-y-1">
                          <Label htmlFor="reg-name" className="text-xs font-semibold">Full Name</Label>
                          <Input
                            id="reg-name"
                            type="text"
                            placeholder="e.g. Priya Sharma"
                            value={regName}
                            onChange={(e) => setRegName(e.target.value)}
                            required
                            className="h-10"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor="reg-email" className="text-xs font-semibold">Email Address</Label>
                          <Input
                            id="reg-email"
                            type="email"
                            placeholder="e.g. priya@gmail.com"
                            value={regEmail}
                            onChange={(e) => setRegEmail(e.target.value)}
                            required
                            className="h-10"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="space-y-1">
                            <Label htmlFor="reg-phone" className="text-xs font-semibold">Mobile Number</Label>
                            <Input
                              id="reg-phone"
                              type="tel"
                              placeholder="9876543210"
                              value={regPhone}
                              onChange={(e) => setRegPhone(e.target.value)}
                              className="h-10"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-semibold">Hostel Branch</Label>
                            <Select value={regHostel} onValueChange={setRegHostel}>
                              <SelectTrigger className="h-10">
                                <SelectValue placeholder="Branch" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Q2">Q2 Girls - Gachibowli</SelectItem>
                                <SelectItem value="Q2.0">Q2 Girls - Kondapur</SelectItem>
                                <SelectItem value="Q2.1">Q2 Girls - Madhapur</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor="reg-password" className="text-xs font-semibold">Create Password</Label>
                          <div className="relative">
                            <Input
                              id="reg-password"
                              type={showPassword ? 'text' : 'password'}
                              placeholder="At least 6 characters"
                              value={regPassword}
                              onChange={(e) => setRegPassword(e.target.value)}
                              required
                              className="h-10 pr-9"
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
                          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md h-11 rounded-xl mt-2"
                        >
                          {isLoading ? 'Creating Account...' : 'Complete Resident Registration'}
                        </Button>
                      </form>
                    </div>
                  ) : (
                    /* SIGN IN MODE */
                    <div className="space-y-4">
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
                                  : 'e.g. kajalsharma / shyam06'
                              }
                              value={identifier}
                              onChange={(e) => setIdentifier(e.target.value)}
                              className="pl-9 h-11"
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
                            <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-3.5" />
                            <Input
                              id="password"
                              type={showPassword ? 'text' : 'password'}
                              placeholder="••••••••••••"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="pl-9 pr-9 h-11"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        <Button
                          type="submit"
                          disabled={isLoading}
                          className={`w-full font-bold shadow-md h-11 rounded-xl ${
                            selectedRole === 'super_admin'
                              ? 'bg-purple-600 hover:bg-purple-700 text-white'
                              : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                          }`}
                        >
                          {isLoading ? 'Signing In...' : 'Sign In to Workspace'}
                        </Button>
                      </form>

                      {/* Google Authentication Section (for students) */}
                      {selectedRole === 'student' && (
                        <div className="pt-1">
                          <div className="relative my-4">
                            <div className="absolute inset-0 flex items-center">
                              <span className="w-full border-t border-border/60" />
                            </div>
                            <div className="relative flex justify-center text-[10px] uppercase">
                              <span className="bg-card px-2.5 text-muted-foreground font-semibold">
                                Or Continue With Google
                              </span>
                            </div>
                          </div>

                          {renderGoogleButton('Continue with Google')}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>

                <CardFooter className="bg-secondary/30 border-t border-border/50 p-4 text-center justify-center flex-col gap-1 text-xs text-muted-foreground">
                  <span>Need assistance with your account?</span>
                  <Link to="/contact" className="font-semibold text-foreground hover:text-primary">
                    Contact Q2 Technical Support
                  </Link>
                </CardFooter>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Google Sign-In Step 2 Completion Modal */}
      {showGoogleStep2 && googleProfileData && (
        <GoogleStep2Modal
          isOpen={showGoogleStep2}
          setupToken={googleSetupToken}
          googleProfile={googleProfileData}
          onSuccess={(user) => {
            setShowGoogleStep2(false);
            navigate('/student/dashboard', { replace: true });
          }}
          onCancel={() => setShowGoogleStep2(false)}
        />
      )}

      <SaaSFooter />
    </div>
  );
}