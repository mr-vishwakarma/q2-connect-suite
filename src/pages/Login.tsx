import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { WorkspaceSelector } from '@/components/auth/WorkspaceSelector';
import { GoogleStep2Modal } from '@/components/auth/GoogleStep2Modal';
import { GoogleInitialDetailsModal } from '@/components/auth/GoogleInitialDetailsModal';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { toast } from 'react-toastify';
import {
  Eye,
  EyeOff,
  GraduationCap,
  Building2,
  ShieldCheck,
  KeyRound,
  RefreshCw,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

type AuthRole = 'student' | 'admin' | 'super_admin';

const normalizeRole = (role: string | null): AuthRole => {
  if (!role) return 'student';
  const clean = role.toLowerCase().trim();
  if (clean === 'super_admin' || clean === 'superadmin' || clean === 'platform') return 'super_admin';
  if (clean === 'admin' || clean === 'hostel_admin' || clean === 'warden') return 'admin';
  if (clean === 'student' || clean === 'resident') return 'student';
  return 'student';
};

interface RoleConfig {
  id: AuthRole;
  label: string;
  fieldPrefix: string;
  identifierPlaceholder: string;
  icon: typeof GraduationCap | typeof Building2 | typeof ShieldCheck;
}

const ROLE_CONFIGS: Record<AuthRole, RoleConfig> = {
  student: {
    id: 'student',
    label: 'Student',
    fieldPrefix: 'Email:',
    identifierPlaceholder: 'elisesmorisev@gmail.com',
    icon: GraduationCap,
  },
  admin: {
    id: 'admin',
    label: 'Admin',
    fieldPrefix: 'Admin ID:',
    identifierPlaceholder: 'admin@hosteliq.com',
    icon: Building2,
  },
  super_admin: {
    id: 'super_admin',
    label: 'Super Admin',
    fieldPrefix: 'Email:',
    identifierPlaceholder: 'superadmin@hosteliq.com',
    icon: ShieldCheck,
  },
};

export default function Login() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRole = normalizeRole(searchParams.get('role'));

  const [selectedRole, setSelectedRole] = useState<AuthRole>(initialRole);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

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

  // Handle incoming OAuth callback query parameters
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      const msg = decodeURIComponent(errorParam);
      setErrorBanner(msg);
      toast.error(msg, { toastId: 'oauth-error' });
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('error');
      setSearchParams(newParams, { replace: true });
      return;
    }

    const statusParam = searchParams.get('status');
    if (statusParam === 'pending_approval') {
      toast.info('Your registration request is pending admin approval. You will receive an update once verified.', { toastId: 'oauth-pending' });
      return;
    }

    const statusParamRejected = searchParams.get('status');
    if (statusParamRejected === 'rejected') {
      const reason = searchParams.get('reason') || 'Please contact administration.';
      const msg = `Registration not approved: ${decodeURIComponent(reason)}`;
      setErrorBanner(msg);
      toast.error(msg, { toastId: 'oauth-rejected' });
      return;
    }

    const setupTokenParam = searchParams.get('setupToken');
    if (setupTokenParam) {
      const emailParam = searchParams.get('email') || '';
      setGoogleSetupToken(setupTokenParam);
      setGoogleProfileData({ email: emailParam });
      setShowGoogleStep2(true);
      return;
    }

    const tokenParam = searchParams.get('accessToken') || searchParams.get('token');
    const refreshParam = searchParams.get('refreshToken');
    const returnToParam = searchParams.get('returnTo');

    if (tokenParam && refreshParam) {
      localStorage.setItem('accessToken', tokenParam);
      localStorage.setItem('refreshToken', refreshParam);

      window.history.replaceState({}, document.title, window.location.pathname);
      toast.success('Signed in with Google!', { toastId: 'oauth-success' });

      if (returnToParam && returnToParam.startsWith('/')) {
        navigate(returnToParam, { replace: true });
      } else {
        window.location.href = '/';
      }
    }
  }, [searchParams, setSearchParams, navigate]);

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
    setErrorBanner(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);

    if (!identifier.trim() || !password) {
      setErrorBanner('Please enter your email and password');
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

        const msg = error.message || 'Invalid email or password';
        setErrorBanner(msg);
        toast.error(msg, { toastId: 'auth-login-error' });
        return;
      }

      toast.success('Welcome back to Hosteliq!', { toastId: 'auth-login-success' });

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
      const msg = err?.response?.data?.message || err?.message || 'Authentication failed. Please verify credentials.';
      setErrorBanner(msg);
      toast.error(msg, { toastId: 'auth-login-error' });
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length < 6) {
      toast.error('Please enter the 6-digit OTP code', { toastId: 'auth-login-error' });
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
        const msg = result.error.message || 'Google authentication failed';
        setErrorBanner(msg);
        toast.error(msg, { toastId: 'auth-login-error' });
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
      const msg = err?.message || 'Google authentication failed';
      setErrorBanner(msg);
      toast.error(msg, { toastId: 'auth-login-error' });
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

  const handleSocialGoogleClick = () => {
    if (!hasValidGoogleClientId) {
      handleDemoGoogleLogin();
    }
  };

  const config = ROLE_CONFIGS[selectedRole];

  if (showWorkspaceSelect) {
    return (
      <AuthLayout heading="Select Workspace" subheading="Choose the property you wish to manage" variant="login">
        <WorkspaceSelector
          userName={identifier || 'Admin'}
          workspaces={workspaces}
          onSelectWorkspace={() => navigate('/admin/dashboard')}
        />
      </AuthLayout>
    );
  }

  return (
    <GoogleOAuthProvider clientId={activeGoogleClientId || 'test-client-id'}>
      <AuthLayout
        heading="Welcome back"
        subheading="Sign in to your account"
        variant="login"
        glowColor="coral"
      >
        {/* Role Segmented Capsule Selector */}
        <div className="flex items-center justify-between p-1 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md mb-5 sm:mb-6">
          {(['student', 'admin', 'super_admin'] as AuthRole[]).map((roleKey) => {
            const isSelected = selectedRole === roleKey;
            const rConfig = ROLE_CONFIGS[roleKey];
            const IconComponent = rConfig.icon;
            return (
              <button
                key={roleKey}
                type="button"
                role="tab"
                id={`tab-${roleKey}`}
                aria-selected={isSelected}
                aria-controls={`panel-${roleKey}`}
                onClick={() => handleRoleChange(roleKey)}
                className={`flex-1 py-1.5 px-2 xs:px-2.5 rounded-full text-[11px] xs:text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 ${
                  isSelected
                    ? 'bg-gradient-to-r from-white/[0.18] to-white/[0.08] text-white shadow-sm border border-white/20'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
                }`}
              >
                <IconComponent className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#ff4d5a]' : 'text-zinc-400'}`} />
                <span className="truncate">{rConfig.label}</span>
              </button>
            );
          })}
        </div>

        {/* MFA / OTP STEP VIEW */}
        {mfaData?.required ? (
          <div className="space-y-4 text-left">
            <div className="text-center space-y-1 mb-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-[#ff4d5a] flex items-center justify-center mx-auto mb-2">
                <KeyRound className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">Verify Identity</h2>
              <p className="text-xs text-zinc-400">
                Enter the 6-digit code sent to <strong className="text-zinc-200">{mfaData.destinationMasked}</strong>
              </p>
            </div>

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="mfa-otp" className="text-xs font-medium text-zinc-300">
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
                  className="h-12 text-center text-lg tracking-[0.4em] font-mono font-bold bg-[#181924]/90 border-white/[0.1] text-white rounded-2xl focus-visible:border-[#ff4d5a] focus-visible:ring-1 focus-visible:ring-[#ff4d5a]"
                  autoFocus
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading || otpCode.length < 6}
                className="w-full h-12 rounded-full bg-gradient-to-r from-[#ff4d5a] to-[#ff2a5f] hover:from-[#ff5e6a] hover:to-[#ff3a6d] text-white font-medium text-sm transition-all shadow-[0_0_20px_rgba(255,75,90,0.4)] disabled:opacity-50"
              >
                {isLoading ? 'Verifying Code...' : 'Confirm & Open Portal'}
              </Button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setMfaData(null)}
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  ← Back to Sign In
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0}
                  className={`flex items-center gap-1 font-medium ${
                    resendCooldown > 0 ? 'text-zinc-500 cursor-not-allowed' : 'text-[#ff4d5a] hover:underline'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resendCooldown > 0 ? 'animate-spin' : ''}`} />
                  <span>{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}</span>
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* STANDARD CREDENTIALS LOGIN FORM */
          <div id={`panel-${selectedRole}`} role="tabpanel" aria-labelledby={`tab-${selectedRole}`}>
            {/* Error Banner */}
            {errorBanner && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-950/40 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorBanner}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-3.5 text-left" noValidate>
              {/* Identifier Input Pill — EXACT equal height and width as password pill */}
              <div className="h-[52px] sm:h-[56px] w-full rounded-full bg-[#181924]/90 border border-white/[0.10] focus-within:border-white/30 focus-within:ring-2 focus-within:ring-white/10 px-4 sm:px-5 flex items-center transition-all box-border">
                <span className="text-zinc-400 font-medium text-xs sm:text-sm mr-2 shrink-0 select-none">
                  {config.fieldPrefix}
                </span>
                <input
                  id="login-identifier"
                  type="text"
                  placeholder={config.identifierPlaceholder}
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (errorBanner) setErrorBanner(null);
                  }}
                  required
                  autoComplete="username"
                  className="bg-transparent border-0 outline-none text-white text-xs sm:text-sm w-full placeholder:text-zinc-600 focus:ring-0 p-0 leading-normal"
                />
              </div>

              {/* Password Input Pill — EXACT equal height, width, and border styling */}
              <div className="h-[52px] sm:h-[56px] w-full rounded-full bg-[#181924]/90 border border-white/[0.10] focus-within:border-white/30 focus-within:ring-2 focus-within:ring-white/10 pl-4 sm:pl-5 pr-1.5 flex items-center justify-between transition-all box-border">
                <div className="flex items-center flex-1 mr-2 min-w-0">
                  <span className="text-zinc-400 font-medium text-xs sm:text-sm mr-2 shrink-0 select-none">
                    Password:
                  </span>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorBanner) setErrorBanner(null);
                    }}
                    required
                    autoComplete="current-password"
                    className="bg-transparent border-0 outline-none text-white text-xs sm:text-sm w-full placeholder:text-zinc-600 tracking-wider focus:ring-0 p-0 leading-normal"
                  />
                </div>

                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  {/* Subtle eye toggle */}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="text-zinc-500 hover:text-zinc-300 p-1 sm:p-1.5 rounded-full transition-colors focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>

                  {/* Circular glowing gradient submit button with right arrow */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    aria-label="Sign In"
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-r from-[#ff4d5a] to-[#ff2a5f] hover:from-[#ff5e6a] hover:to-[#ff3a6d] text-white flex items-center justify-center shrink-0 shadow-[0_0_18px_rgba(255,75,90,0.6)] hover:shadow-[0_0_25px_rgba(255,75,90,0.85)] hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:scale-100 cursor-pointer focus:outline-none"
                  >
                    {isLoading ? (
                      <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white stroke-[2.5]" />
                    )}
                  </button>
                </div>
              </div>

              {/* Forgot Password Link */}
              <div className="flex justify-end pt-0.5">
                <Link
                  to="/forgot-password"
                  className="text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>
            </form>

            {/* Divider: OR */}
            <div className="flex items-center gap-3 my-4 sm:my-5">
              <div className="flex-1 h-px bg-white/[0.08]" />
              <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 select-none">
                OR
              </span>
              <div className="flex-1 h-px bg-white/[0.08]" />
            </div>

            {/* Social Login Button: Google (Apple icon removed) */}
            <div className="relative w-full h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-[#181924]/80 border border-white/[0.08] hover:bg-white/[0.05] hover:border-white/20 transition-all flex items-center justify-center group overflow-hidden">
              {hasValidGoogleClientId ? (
                <div className="absolute inset-0 opacity-0 overflow-hidden flex items-center justify-center cursor-pointer">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => {
                      const msg = 'Google Sign In failed. Please check configuration.';
                      setErrorBanner(msg);
                      toast.error(msg, { toastId: 'auth-login-error' });
                    }}
                    shape="rectangular"
                    theme="filled_black"
                    size="large"
                    width="360"
                  />
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleSocialGoogleClick}
                disabled={isLoading}
                className="w-full h-full flex items-center justify-center gap-2.5 px-4 text-xs font-semibold text-zinc-200 focus:outline-none"
                title="Sign in with Google"
              >
                <svg className="w-5 h-5 shrink-0 group-hover:scale-105 transition-transform" viewBox="0 0 24 24" aria-hidden="true">
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
            </div>

            {/* Understated Connect With Us link */}
            <p className="text-center text-xs text-zinc-400 mt-5 sm:mt-6">
              Looking to manage your hostel?{' '}
              <Link
                to="/connect"
                className="font-semibold text-rose-400 hover:text-rose-300 hover:underline transition-colors"
              >
                Connect with us
              </Link>
            </p>
          </div>
        )}

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
            onSuccess={() => {
              setShowGoogleStep2(false);
              navigate('/student/dashboard', { replace: true });
            }}
            onCancel={() => setShowGoogleStep2(false)}
          />
        )}
      </AuthLayout>
    </GoogleOAuthProvider>
  );
}
