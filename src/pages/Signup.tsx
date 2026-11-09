import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'react-toastify';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Field-specific validation errors
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    terms?: string;
    general?: string;
  }>({});

  const { signUp } = useAuth();
  const navigate = useNavigate();

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (!name.trim()) {
      newErrors.name = 'Full name is required';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (!email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!acceptTerms) {
      newErrors.terms = 'You must accept the Terms of Service and Privacy Policy';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsLoading(true);
    setErrors((prev) => ({ ...prev, general: undefined }));

    try {
      const username = email.trim().split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '') || `user_${Date.now()}`;

      const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        username,
        role: 'student',
      };

      const { error, user } = await signUp(payload);
      setIsLoading(false);

      if (error) {
        const msg = error.message || 'Registration failed';
        setErrors((prev) => ({ ...prev, general: msg }));
        toast.error(msg, { toastId: 'signup-error' });
        return;
      }

      toast.success('Account created! Welcome to Hosteliq.', { toastId: 'signup-success' });

      // Route based on verified role
      if (user?.role === 'admin' || user?.isAdmin) {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/login?role=student', { replace: true });
      }
    } catch (err: any) {
      setIsLoading(false);
      const msg = err?.response?.data?.message || err?.message || 'Unable to create account. Please try again.';
      setErrors((prev) => ({ ...prev, general: msg }));
      toast.error(msg, { toastId: 'signup-error' });
    }
  };

  return (
    <AuthLayout
      heading="Join us in a Snap"
      variant="signup"
      glowColor="purple"
    >
      {/* General error message banner */}
      {errors.general && (
        <div className="mb-4 p-3 rounded-2xl bg-rose-950/40 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300 text-left">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{errors.general}</span>
        </div>
      )}

      {/* Registration Form (Clean Single-Form Matching Reference 2) */}
      <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4 text-left" noValidate>
        {/* Full Name */}
        <div className="space-y-1 sm:space-y-1.5">
          <label htmlFor="signup-name" className="text-xs font-medium text-zinc-300 block">
            Full Name
          </label>
          <input
            id="signup-name"
            type="text"
            placeholder="John Doe"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            autoComplete="name"
            required
            className={`w-full h-11 sm:h-12 px-3.5 sm:px-4 rounded-xl sm:rounded-2xl bg-[#181926]/90 border text-xs sm:text-sm text-white placeholder:text-zinc-500 outline-none transition-all ${
              errors.name
                ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                : 'border-white/[0.08] focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/15'
            }`}
          />
          {errors.name && (
            <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.name}</span>
            </p>
          )}
        </div>

        {/* Email Address */}
        <div className="space-y-1 sm:space-y-1.5">
          <label htmlFor="signup-email" className="text-xs font-medium text-zinc-300 block">
            Email Address
          </label>
          <input
            id="signup-email"
            type="email"
            placeholder="example@site.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            autoComplete="email"
            required
            className={`w-full h-11 sm:h-12 px-3.5 sm:px-4 rounded-xl sm:rounded-2xl bg-[#181926]/90 border text-xs sm:text-sm text-white placeholder:text-zinc-500 outline-none transition-all ${
              errors.email
                ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                : 'border-white/[0.08] focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/15'
            }`}
          />
          {errors.email && (
            <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.email}</span>
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1 sm:space-y-1.5">
          <label htmlFor="signup-password" className="text-xs font-medium text-zinc-300 block">
            Password
          </label>
          <div className="relative">
            <input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              autoComplete="new-password"
              required
              className={`w-full h-11 sm:h-12 pl-3.5 sm:pl-4 pr-14 sm:pr-16 rounded-xl sm:rounded-2xl bg-[#181926]/90 border text-xs sm:text-sm text-white placeholder:text-zinc-500 outline-none transition-all ${
                errors.password
                  ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                  : 'border-white/[0.08] focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/15'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors focus:outline-none"
            >
              {showPassword ? 'hide' : 'show'}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.password}</span>
            </p>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-1 sm:space-y-1.5">
          <label htmlFor="signup-confirm-password" className="text-xs font-medium text-zinc-300 block">
            Confirm Password
          </label>
          <div className="relative">
            <input
              id="signup-confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Minimum 8 characters"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
              }}
              autoComplete="new-password"
              required
              className={`w-full h-11 sm:h-12 pl-3.5 sm:pl-4 pr-12 rounded-xl sm:rounded-2xl bg-[#181926]/90 border text-xs sm:text-sm text-white placeholder:text-zinc-500 outline-none transition-all ${
                errors.confirmPassword
                  ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                  : 'border-white/[0.08] focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/15'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
              className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors focus:outline-none p-1"
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.confirmPassword}</span>
            </p>
          )}
        </div>

        {/* Terms & Conditions with Toggle Switch */}
        <div className="flex items-center justify-between py-1.5 sm:py-2">
          <div className="space-y-0.5 pr-3 sm:pr-4">
            <p className="text-xs font-medium text-zinc-200">Terms & Conditions</p>
            <p className="text-[11px] text-zinc-400 leading-snug">
              Accept our{' '}
              <a href="/terms" target="_blank" rel="noreferrer" className="text-purple-400 hover:underline">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="/privacy" target="_blank" rel="noreferrer" className="text-purple-400 hover:underline">
                Privacy Policy
              </a>
              .
            </p>
          </div>
          <Switch
            checked={acceptTerms}
            onCheckedChange={(checked) => {
              setAcceptTerms(checked);
              if (errors.terms) setErrors((prev) => ({ ...prev, terms: undefined }));
            }}
            className="data-[state=checked]:bg-[#8b5cf6] data-[state=unchecked]:bg-zinc-800 shrink-0"
          />
        </div>
        {errors.terms && (
          <p className="text-xs text-rose-400 -mt-2 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errors.terms}</span>
          </p>
        )}

        {/* Primary CTA Submit Button: Begin Your Journey */}
        <button
          type="submit"
          disabled={isLoading || !acceptTerms}
          className="w-full h-11 sm:h-12 rounded-full font-semibold text-xs sm:text-sm text-white bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] hover:from-[#9d4edd] hover:to-[#8b5cf6] shadow-[0_0_25px_rgba(139,92,246,0.35)] transition-all duration-200 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center mt-2 focus:outline-none"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Creating account...</span>
            </div>
          ) : (
            <span>Begin Your Journey</span>
          )}
        </button>
      </form>

      {/* Google Sign-up Option */}
      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-white/[0.08]" />
        <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 select-none">
          OR
        </span>
        <div className="flex-1 h-px bg-white/[0.08]" />
      </div>

      <button
        type="button"
        onClick={() => navigate('/login?role=student')}
        className="w-full h-11 flex items-center justify-center gap-2.5 px-4 rounded-full border border-white/[0.1] bg-[#181926]/80 hover:bg-white/[0.05] text-xs font-semibold text-zinc-200 transition-colors focus:outline-none"
      >
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
        <span>Sign up with Google</span>
      </button>

      {/* Footer link to Sign in */}
      <p className="text-center text-xs text-zinc-400 mt-4 sm:mt-5">
        Already have an account?{' '}
        <Link
          to="/login"
          className="font-semibold text-purple-400 hover:text-purple-300 hover:underline transition-colors"
        >
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
