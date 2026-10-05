import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleLogin } from '@react-oauth/google';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WorkspaceSelector } from '@/components/auth/WorkspaceSelector';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'react-toastify';
import {
  Eye,
  EyeOff,
  ShieldCheck,
  Building2,
  GraduationCap,
  Lock,
  Mail,
  User as UserIcon,
  ArrowRight,
  Shield,
  KeyRound,
  RefreshCw,
  Info,
} from 'lucide-react';
import { GoogleStep2Modal } from '@/components/auth/GoogleStep2Modal';
import { GoogleInitialDetailsModal } from '@/components/auth/GoogleInitialDetailsModal';
import { api } from '@/lib/api';

type AuthRole = 'super_admin' | 'admin' | 'student';

const normalizeRole = (role: string | null): AuthRole => {
  if (!role) return 'admin';
  const clean = role.toLowerCase().trim();
  if (clean === 'super_admin' || clean === 'superadmin' || clean === 'platform') return 'super_admin';
  if (clean === 'admin' || clean === 'hostel_admin' || clean === 'warden') return 'admin';
  if (clean === 'student' || clean === 'resident') return 'student';
  return 'admin';
};

interface RoleConfig {
  id: AuthRole;
  label: string;
  badge: string;
  title: string;
  subtitle: string;
  identifierLabel: string;
  identifierPlaceholder: string;
  identifierIcon: typeof Mail | typeof UserIcon | typeof GraduationCap;
  ctaText: string;
  securityFooter: string;
  icon: typeof ShieldCheck | typeof Building2 | typeof GraduationCap;
}

const ROLE_CONFIGS: Record<AuthRole, RoleConfig> = {
  super_admin: {
    id: 'super_admin',
    label: 'Super Admin',
    badge: 'PLATFORM CONTROL',
    title: 'Platform Administration',
    subtitle: 'Sign in with platform credentials to access multi-tenant infrastructure',
    identifierLabel: 'Administrator Email',
    identifierPlaceholder: 'superadmin@q2connect.com',
    identifierIcon: Mail,
    ctaText: 'Sign In to Platform',
    securityFooter: 'SECURE PLATFORM ACCESS',
    icon: ShieldCheck,
  },
  admin: {
    id: 'admin',
    label: 'Hostel Admin',
    badge: 'OPERATIONS HUB',
    title: 'Hostel Management Portal',
    subtitle: 'Manage property rooms, fee ledgers & staff operations',
    identifierLabel: 'Email or Staff Username',
    identifierPlaceholder: 'admin@q2hostels.com or username',
    identifierIcon: UserIcon,
    ctaText: 'Sign In to Hostel Hub',
    securityFooter: 'SECURE HOSTEL ACCESS',
    icon: Building2,
  },
  student: {
    id: 'student',
    label: 'Student',
    badge: 'RESIDENT ACCESS',
    title: 'Student Resident Portal',
    subtitle: 'Access assigned room details, fee invoices & gate pass requests',
    identifierLabel: 'Student User ID or Email',
    identifierPlaceholder: 'e.g. nikhil or resident@q2hostels.com',
    identifierIcon: GraduationCap,
    ctaText: 'Sign In to Resident App',
    securityFooter: 'STUDENT RESIDENT ACCESS',
    icon: GraduationCap,
  },
};

export default function Login() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRole = normalizeRole(searchParams.get('role'));

  const [selectedRole, setSelectedRole] = useState<AuthRole>(initialRole);

  // Sign In credentials
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // MFA / OTP step state
  const [mfaData, setMfaData] = useState<{
    required: boolean;
    mfaToken?: string;
    destinationMasked?: string;
  } | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Google Step 2 Completion State (After Admin Approval)
  const [showGoogleStep2, setShowGoogleStep2] = useState(false);
  const [googleSetupToken, setGoogleSetupToken] = useState('');
  const [googleProfileData, setGoogleProfileData] = useState<any>(null);

  // Google Initial Details (Step 1) State (Pending Admin Approval)
  const [showInitialModal, setShowInitialModal] = useState(false);
  const [initialGoogleProfile, setInitialGoogleProfile] = useState<any>(null);
  const [initialCredential, setInitialCredential] = useState('');

  // Workspace selection state
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [showWorkspaceSelect, setShowWorkspaceSelect] = useState(false);

  const { signIn, signInWithGoogle, requestGoogleRegistration, user, isAdmin } = useAuth();
  const navigate = useNavigate();

  // Sync role when URL search parameter changes
  useEffect(() => {
    const roleParam = searchParams.get('role');
    if (roleParam) {
      const normalized = normalizeRole(roleParam);
      setSelectedRole(normalized);
    }
  }, [searchParams]);

  // Authenticated redirect guard: if already logged in and visiting without query, route to verified portal
  useEffect(() => {
    const roleParam = searchParams.get('role');
    if (user && !roleParam) {
      if (user.role === 'super_admin' || user.isSuperAdmin) {
        navigate('/super-admin/dashboard', { replace: true });
      } else if (user.role === 'admin' || isAdmin) {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/student/dashboard', { replace: true });
      }
    }
  }, [user, isAdmin, searchParams, navigate]);

  // OTP resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleRoleChange = (newRole: AuthRole) => {
    if (selectedRole === newRole) return;
    setSelectedRole(newRole);
    setSearchParams({ role: newRole }, { replace: true });
    setPassword('');
    setMfaData(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!identifier.trim() || !password) {
      toast.error('Please enter your credentials', { toastId: 'auth-login-error' });
      return;
    }

    setIsLoading(true);

    try {
      const { error, user: loggedUser } = await signIn(
        identifier.trim(),
        password,
        selectedRole
      );

      setIsLoading(false);

      if (error) {
        // Check if backend challenged for MFA / OTP
        if (error.code === 'MFA_REQUIRED' || error.requiresMfa) {
          setMfaData({
            required: true,
            mfaToken: error.mfaToken,
            destinationMasked: error.destinationMasked || identifier.trim(),
          });
          setResendCooldown(45);
          toast.info('Two-factor authentication code sent. Please enter the OTP.', { toastId: 'auth-mfa-info' });
          return;
        }

        // Show single error toast with unique toastId to prevent duplicate toasts
        toast.error(error.message || 'Authentication failed', { toastId: 'auth-login-error' });
        return;
      }

      toast.success('Welcome back to Q2!', { toastId: 'auth-login-success' });

      // AUTHORITATIVE DESTINATION: Derived strictly from verified server-side role
      const verifiedRole = loggedUser?.role;
      const isSuper = Boolean(loggedUser?.isSuperAdmin || verifiedRole === 'super_admin');

      if (isSuper) {
        navigate('/super-admin/dashboard', { replace: true });
      } else if (verifiedRole === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/student/dashboard', { replace: true });
      }
    } catch (err: any) {
      setIsLoading(false);
      const msg = err?.response?.data?.message || err?.message || 'Authentication failed';
      toast.error(msg, { toastId: 'auth-login-error' });
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length < 6) {
      toast.error('Please enter the 6-digit OTP verification code', { toastId: 'auth-login-error' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/auth/verify-otp', {
        mfaToken: mfaData?.mfaToken,
        otp: otpCode.trim(),
        portal: selectedRole === 'super_admin' ? 'SUPER_ADMIN' : selectedRole === 'admin' ? 'ADMIN' : 'STUDENT',
      });

      setIsLoading(false);
      if (response.data?.success) {
        toast.success('Identity verified!', { toastId: 'auth-login-success' });
        const u = response.data.user;
        if (u?.isSuperAdmin || u?.role === 'super_admin') {
          navigate('/super-admin/dashboard', { replace: true });
        } else if (u?.role === 'admin') {
          navigate('/admin/dashboard', { replace: true });
        } else {
          navigate('/student/dashboard', { replace: true });
        }
      } else {
        toast.error(response.data?.message || 'Verification failed', { toastId: 'auth-login-error' });
      }
    } catch (err: any) {
      setIsLoading(false);
      toast.error(err.response?.data?.message || err.message || 'Invalid or expired verification code', { toastId: 'auth-login-error' });
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    try {
      await api.post('/auth/resend-otp', {
        mfaToken: mfaData?.mfaToken,
      });
      setResendCooldown(60);
      toast.success('A new verification code has been dispatched.', { toastId: 'auth-mfa-info' });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to resend code', { toastId: 'auth-login-error' });
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (!credentialResponse?.credential) {
      toast.error('Google Sign In did not return a credential.', { toastId: 'auth-login-error' });
      return;
    }

    setIsLoading(true);

    try {
      const portal = selectedRole || 'student';
      const result = await signInWithGoogle(credentialResponse.credential, portal);
      setIsLoading(false);

      if (result.error) {
        toast.error(result.error.message || 'Google authentication failed', { toastId: 'auth-login-error' });
        return;
      }

      if (result.status === 'new_resident' && result.requiresInitialDetails) {
        setInitialGoogleProfile(result.googleProfile);
        setInitialCredential(credentialResponse.credential);
        setShowInitialModal(true);
        toast.info('Google account verified! Please enter your phone number & preferred hostel branch.', { toastId: 'auth-google-info' });
        return;
      }

      if (result.status === 'pending_approval') {
        toast.info(result.message || 'Your registration request is pending admin approval.', { toastId: 'auth-google-info' });
        return;
      }

      if (result.status === 'approved' && result.canCompleteSetup) {
        setGoogleSetupToken(result.setupToken || '');
        setGoogleProfileData(result.googleProfile);
        setShowGoogleStep2(true);
        toast.success('Congratulations! Your application has been approved. Please choose your password.', { toastId: 'auth-google-info' });
        return;
      }

      const loggedUser = result.user;
      toast.success(`Welcome ${loggedUser?.name || 'back'}! (Authenticated via Google)`, { toastId: 'auth-login-success' });

      const verifiedRole = loggedUser?.role;
      const isSuper = Boolean(loggedUser?.isSuperAdmin || verifiedRole === 'super_admin');
      if (isSuper) {
        navigate('/super-admin/dashboard', { replace: true });
      } else if (verifiedRole === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/student/dashboard', { replace: true });
      }
    } catch (err: any) {
      setIsLoading(false);
      toast.error(err?.message || 'Google authentication failed', { toastId: 'auth-login-error' });
    }
  };

  const handleInitialDetailsSubmit = async (details: { name: string; phone: string; hostel: string }) => {
    setIsLoading(true);
    try {
      const result = await requestGoogleRegistration({
        credential: initialCredential,
        name: details.name,
        phone: details.phone,
        hostel: details.hostel,
      });

      setIsLoading(false);
      setShowInitialModal(false);

      if (result.error) {
        toast.error(result.error.message || 'Failed to submit registration request', { toastId: 'auth-login-error' });
        return;
      }

      toast.success('Registration request submitted! Awaiting hostel administrator approval.', { toastId: 'auth-google-info' });
    } catch (err: any) {
      setIsLoading(false);
      toast.error(err?.message || 'Submission failed', { toastId: 'auth-login-error' });
    }
  };

  const activeGoogleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || import.meta.env.GOOGLE_CLIENT_ID || '').trim();
  const hasValidGoogleClientId = Boolean(
    activeGoogleClientId &&
    activeGoogleClientId.length > 15 &&
    !activeGoogleClientId.includes('not-configured') &&
    !activeGoogleClientId.includes('demo')
  );

  const handleDemoGoogleLogin = async () => {
    let emailToUse = identifier?.includes('@') ? identifier.trim() : '';
    if (!emailToUse) {
      emailToUse = window.prompt(
        'Notice: VITE_GOOGLE_CLIENT_ID is not configured in .env.\nEnter your Google email to test Sign-In & Step 2 Setup:',
        'priya.resident@gmail.com'
      ) || '';
    }
    if (!emailToUse.trim()) return;

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

  const config = ROLE_CONFIGS[selectedRole];
  const CurrentIcon = config.icon;
  const IdentifierIcon = config.identifierIcon;

  return (
    <div className="min-h-screen bg-[#08090C] text-slate-100 flex flex-col justify-center items-center relative overflow-hidden py-12 px-4 selection:bg-red-600 selection:text-white">
      {/* Background Decorative Thin Circles & Matrix Dots (exact match to reference image) */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Top-left subtle red outline arc */}
        <div className="absolute top-10 -left-28 w-[420px] h-[420px] rounded-full border border-red-600/15 pointer-events-none" />
        <div className="absolute top-0 -left-44 w-[560px] h-[560px] rounded-full border border-red-600/[0.08] pointer-events-none" />

        {/* Bottom-right subtle red outline arc */}
        <div className="absolute -bottom-24 -right-28 w-[420px] h-[420px] rounded-full border border-red-600/15 pointer-events-none" />
        <div className="absolute -bottom-40 -right-44 w-[560px] h-[560px] rounded-full border border-red-600/[0.08] pointer-events-none" />

        {/* Left Matrix Dots */}
        <div className="absolute top-1/3 left-12 hidden lg:grid grid-cols-6 gap-3.5 opacity-25 pointer-events-none">
          {Array.from({ length: 36 }).map((_, i) => (
            <span key={i} className="w-1 h-1 rounded-full bg-slate-400" />
          ))}
        </div>

        {/* Right Matrix Dots */}
        <div className="absolute bottom-1/4 right-12 hidden lg:grid grid-cols-6 gap-3.5 opacity-25 pointer-events-none">
          {Array.from({ length: 36 }).map((_, i) => (
            <span key={i} className="w-1 h-1 rounded-full bg-slate-400" />
          ))}
        </div>
      </div>

      <div className="w-full max-w-[500px] z-10">
        {showWorkspaceSelect ? (
          /* Multi-Tenant Workspace Selector Step */
          <motion.div
            key="workspace-selector"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
            className="w-full"
          >
            <WorkspaceSelector
              userName={identifier || 'Admin'}
              workspaces={workspaces}
              onSelectWorkspace={() => navigate('/admin/dashboard')}
            />
          </motion.div>
        ) : (
          /* Unified Q2 Authentication Card (Exact Reference Architecture) */
          <motion.div
            key="unified-auth-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="w-full"
          >
            {/* Brand Header */}
            <div className="text-center mb-6">
              <Link to="/" className="inline-flex items-center gap-3.5 group mb-2 focus:outline-none">
                <div className="w-11 h-11 rounded-2xl bg-[#14080A] border border-red-500/40 flex items-center justify-center shadow-lg shadow-red-950/40 group-hover:border-red-500 transition-colors">
                  <span className="text-white font-black text-sm tracking-tight">Q2</span>
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xl font-black text-white tracking-tight leading-none">
                    Q2 <span className="text-[#FF1E27] font-extrabold text-sm uppercase tracking-widest">CONNECT</span>
                  </span>
                  <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-widest mt-1">
                    HOSTEL MANAGEMENT SUITE
                  </span>
                </div>
              </Link>
              <p className="text-xs text-slate-400 mt-1">
                Secure access to your verified operating portal
              </p>
            </div>

            {/* Main Auth Card Container */}
            <div className="relative rounded-[24px] bg-[#0E1015] border border-[#1A1D24] shadow-2xl shadow-black/80 backdrop-blur-xl overflow-hidden p-6 sm:p-8">
              {/* ROLE SWITCHER TABLIST */}
              <div className="relative mb-6">
                <div className="flex items-center justify-between text-xs text-slate-300 font-semibold mb-2.5 px-0.5">
                  <span>Select Workspace Role</span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">ROLE SWITCHER</span>
                </div>

                <div
                  role="tablist"
                  aria-label="Q2 Portal Role Selector"
                  className="grid grid-cols-3 gap-1.5 p-1.5 rounded-2xl bg-[#090A0D] border border-[#1A1D24]"
                >
                  {(['super_admin', 'admin', 'student'] as AuthRole[]).map((roleKey) => {
                    const rConfig = ROLE_CONFIGS[roleKey];
                    const isSelected = selectedRole === roleKey;
                    const TabIcon = rConfig.icon;
                    return (
                      <button
                        key={roleKey}
                        type="button"
                        role="tab"
                        id={`tab-${roleKey}`}
                        aria-selected={isSelected}
                        aria-controls={`panel-${roleKey}`}
                        onClick={() => handleRoleChange(roleKey)}
                        className={`relative flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-150 border ${
                          isSelected
                            ? 'bg-[#1A0B0E] text-white border-red-600 shadow-[0_0_12px_rgba(220,38,38,0.25)]'
                            : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#14161C]'
                        }`}
                      >
                        <TabIcon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-red-500' : 'text-slate-400'}`} />
                        <span className="truncate">{rConfig.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* MFA / OTP STEP VIEW */}
              {mfaData?.required ? (
                <motion.div
                  key="mfa-step"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className="space-y-4"
                >
                  <div className="text-center space-y-1 mb-2">
                    <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto mb-2 shadow-lg">
                      <KeyRound className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-bold text-white tracking-tight">Verify Your Identity</h2>
                    <p className="text-xs text-slate-400">
                      Enter the 6-digit authentication code sent to <strong className="text-slate-200">{mfaData.destinationMasked}</strong>
                    </p>
                  </div>

                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="mfa-otp" className="text-xs font-semibold text-slate-300">
                        6-Digit Verification Code
                      </Label>
                      <Input
                        id="mfa-otp"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="123456"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        className="h-12 text-center text-lg tracking-[0.4em] font-mono font-bold bg-[#090A0D] border-[#1E222B] text-white rounded-xl focus:border-red-500"
                        autoFocus
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={isLoading || otpCode.length < 6}
                      className="w-full h-11 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold shadow-lg shadow-red-600/30"
                    >
                      {isLoading ? 'Verifying Code...' : 'Confirm & Open Portal'}
                    </Button>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <button
                        type="button"
                        onClick={() => setMfaData(null)}
                        className="text-slate-400 hover:text-white transition-colors"
                      >
                        ← Back to Sign In
                      </button>
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={resendCooldown > 0}
                        className={`flex items-center gap-1 font-semibold ${
                          resendCooldown > 0 ? 'text-slate-500 cursor-not-allowed' : 'text-red-400 hover:underline'
                        }`}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${resendCooldown > 0 ? 'animate-spin' : ''}`} />
                        <span>{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}</span>
                      </button>
                    </div>
                  </form>
                </motion.div>
              ) : (
                /* STANDARD CREDENTIALS LOGIN VIEW (Matching Attached Reference Image) */
                <div id={`panel-${selectedRole}`} role="tabpanel" aria-labelledby={`tab-${selectedRole}`}>
                  {/* Role Header Banner */}
                  <div className="mb-6 flex items-start gap-3.5 text-left">
                    {/* Icon Box */}
                    <div className="w-12 h-12 rounded-2xl bg-[#170B0E] border border-red-500/20 flex items-center justify-center text-red-500 shrink-0 mt-0.5 shadow-sm">
                      <CurrentIcon className="w-6 h-6" />
                    </div>

                    {/* Titles */}
                    <div className="flex-1">
                      <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest block mb-0.5">
                        {config.badge}
                      </span>
                      <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
                        {config.title}
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                        {config.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Authentication Form */}
                  <form onSubmit={handleSubmit} className="space-y-4 text-left">
                    {/* Identifier Input */}
                    <div className="space-y-1.5">
                      <Label htmlFor="identifier" className="text-xs font-semibold text-slate-200">
                        {config.identifierLabel}
                      </Label>
                      <div className="relative">
                        <IdentifierIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5 pointer-events-none" />
                        <Input
                          id="identifier"
                          type="text"
                          placeholder={config.identifierPlaceholder}
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value)}
                          className="pl-10 h-11 bg-[#090A0D] border-[#1E222B] text-slate-100 placeholder:text-slate-600 rounded-xl text-xs focus-visible:ring-1 focus-visible:ring-red-500 focus-visible:border-red-500"
                          required
                          autoComplete="username"
                        />
                      </div>
                    </div>

                    {/* Password Input */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-xs font-semibold text-slate-200">
                          Password
                        </Label>
                        <Link
                          to="/forgot-password"
                          className="text-xs text-slate-400 hover:text-white transition-colors"
                        >
                          Forgot Password?
                        </Link>
                      </div>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5 pointer-events-none" />
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10 pr-10 h-11 bg-[#090A0D] border-[#1E222B] text-slate-100 placeholder:text-slate-600 rounded-xl text-xs focus-visible:ring-1 focus-visible:ring-red-500 focus-visible:border-red-500"
                          required
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-3.5 top-3 text-slate-400 hover:text-white transition-colors p-0.5"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Sign In CTA Button (Red Glow matching reference image) */}
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-11 rounded-xl bg-gradient-to-r from-[#FF1E27] to-[#E50914] hover:from-[#FF333B] hover:to-[#F4111D] text-white font-bold text-xs shadow-lg shadow-red-600/30 transition-all duration-150 flex items-center justify-center gap-2 mt-3 cursor-pointer"
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Authenticating...</span>
                        </div>
                      ) : (
                        <>
                          <span>{config.ctaText}</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  </form>

                  {/* Divider: OR */}
                  <div className="relative my-5">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-[#1E222B]" />
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider">
                      <span className="bg-[#0E1015] px-3 text-slate-500 font-mono">
                        OR
                      </span>
                    </div>
                  </div>

                  {/* Google OAuth Section (Available for Student Resident Portal) */}
                  {selectedRole === 'student' && (
                    <div className="mb-4">
                      {hasValidGoogleClientId ? (
                        <div className="flex justify-center w-full [&>div]:!w-full [&>div>iframe]:!w-full">
                          <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={() => toast.error('Google Sign In failed. Please check configuration.', { toastId: 'auth-login-error' })}
                            theme="filled_black"
                            size="large"
                            shape="rectangular"
                            text="continue_with"
                            width="100%"
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleDemoGoogleLogin}
                          disabled={isLoading}
                          className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl border border-[#1E222B] bg-[#090A0D] hover:bg-[#14161C] text-xs font-semibold text-slate-200 transition-all shadow-sm group"
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
                          <span>Continue with Google</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Security Badge Footer (Matching Reference Image) */}
                  <div className="flex flex-col items-center justify-center gap-1 text-center">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300 tracking-wider">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>{config.securityFooter}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      AES-256 Bit Encrypted • Role Isolation Enforced
                    </span>
                  </div>

                  {/* Student Account Notice */}
                  {selectedRole === 'student' && (
                    <div className="mt-3 p-2.5 rounded-xl bg-[#090A0D] border border-[#1A1D24] text-left flex items-start gap-2 text-[11px] text-slate-400">
                      <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                      <span>
                        New Resident? Accounts are provisioned by your hostel administrator upon room allocation. Contact your property manager for credentials.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Assistance Footer Link (Matching Reference Image) */}
            <div className="mt-6 text-center text-xs text-slate-400 space-x-1">
              <span>Need technical assistance?</span>
              <Link to="/contact" className="font-semibold text-slate-200 hover:text-white underline underline-offset-4">
                Contact Q2 Technical Support
              </Link>
            </div>
          </motion.div>
        )}
      </div>

      {/* Google Step 1: Initial Details Modal for New Residents */}
      {showInitialModal && initialGoogleProfile && (
        <GoogleInitialDetailsModal
          isOpen={showInitialModal}
          googleProfile={initialGoogleProfile}
          onSubmitDetails={handleInitialDetailsSubmit}
          onClose={() => setShowInitialModal(false)}
          isLoading={isLoading}
        />
      )}

      {/* Google Sign-In Step 2 Completion Modal */}
      {showGoogleStep2 && googleProfileData && (
        <GoogleStep2Modal
          isOpen={showGoogleStep2}
          setupToken={googleSetupToken}
          googleProfile={googleProfileData}
          onSuccess={(u) => {
            setShowGoogleStep2(false);
            navigate('/student/dashboard', { replace: true });
          }}
          onCancel={() => setShowGoogleStep2(false)}
        />
      )}
    </div>
  );
}