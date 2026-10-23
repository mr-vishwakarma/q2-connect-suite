import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, CheckCircle2, ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [expiredNotice, setExpiredNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { signOut } = useAuth();

  useEffect(() => {
    signOut();
  }, [signOut]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    
    if (!token) {
      setErrorMsg('Invalid or missing reset token');
      toast.error('Invalid or missing reset token');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match');
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long');
      toast.error('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);
    setExpiredNotice(null);

    try {
      const response = await api.post('/auth/password/reset', {
        token: token.trim(),
        newPassword: password,
        confirmPassword,
      });

      if (response.data?.success) {
        setIsSuccess(true);
        toast.success('Your password has been reset. You can continue to log in.');
      }
    } catch (error: any) {
      if (error.response?.data?.expired) {
        const msg = error.response.data.message || 'This reset link has expired. A fresh reset link has been sent to your email.';
        setExpiredNotice(msg);
        toast.info(msg, { autoClose: 10000 });
      } else {
        const msg = error.response?.data?.message || 'Failed to reset password. If your link expired, please request a new one.';
        setErrorMsg(msg);
        toast.error(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <AuthLayout
        heading="Password reset complete"
        subheading="Your account credentials have been successfully updated"
        footer={
          <p>
            Ready to log in?{' '}
            <Link
              to="/login"
              className="font-medium text-[#b794f4] hover:text-[#d6bcfa] hover:underline transition-colors"
            >
              Sign in
            </Link>
          </p>
        }
      >
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 text-xs text-left space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Security Verified</span>
            </div>
            <p className="text-emerald-300/80 leading-relaxed">
              Your password has been updated and past sessions invalidated. You can now sign in with your updated password.
            </p>
          </div>

          <Button
            onClick={() => {
              window.location.href = '/login';
            }}
            className="w-full h-11 rounded-[10px] bg-[#9d4edd] hover:bg-[#8b5cf6] text-white font-medium text-sm transition-all shadow-md shadow-purple-900/20 gap-2"
          >
            <span>Continue to Sign In</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (!token) {
    return (
      <AuthLayout
        heading="Invalid reset link"
        subheading="This password reset link is invalid or has expired"
        footer={
          <p>
            Return to{' '}
            <Link
              to="/login"
              className="font-medium text-[#b794f4] hover:text-[#d6bcfa] hover:underline transition-colors"
            >
              Sign in
            </Link>
          </p>
        }
      >
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">
            The password reset link was either already used or expired. Please generate a new password reset request.
          </p>
          <Button
            onClick={() => navigate('/forgot-password')}
            className="w-full h-11 rounded-[10px] bg-[#9d4edd] hover:bg-[#8b5cf6] text-white font-medium text-sm transition-all shadow-md shadow-purple-900/20"
          >
            Request New Reset Link
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      heading="Set new password"
      subheading="Create a secure new password for your Hosteliq account"
      footer={
        <p>
          Remember your password?{' '}
          <Link
            to="/login"
            className="font-medium text-[#b794f4] hover:text-[#d6bcfa] hover:underline transition-colors"
          >
            Sign in
          </Link>
        </p>
      }
    >
      {errorMsg && (
        <div className="mb-4 p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 flex items-start gap-2 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {expiredNotice && (
        <div className="mb-4 p-3 rounded-xl bg-purple-950/30 border border-purple-500/30 text-xs text-purple-200">
          <p className="font-semibold mb-1">Fresh Reset Link Dispatched</p>
          <p className="text-purple-300/80 leading-relaxed">{expiredNotice}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-left" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="reset-new-password" className="text-xs font-medium text-zinc-300">
            New Password
          </Label>
          <div className="relative">
            <Input
              id="reset-new-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="••••••••••••"
              required
              minLength={6}
              autoComplete="new-password"
              className="h-11 pl-3.5 pr-10 bg-[#161720] border-[#262835] text-white placeholder:text-zinc-500 rounded-[10px] text-sm focus-visible:border-[#9d4edd] focus-visible:ring-1 focus-visible:ring-[#9d4edd] transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1 focus:outline-none transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reset-confirm-password" className="text-xs font-medium text-zinc-300">
            Confirm New Password
          </Label>
          <div className="relative">
            <Input
              id="reset-confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="••••••••••••"
              required
              minLength={6}
              autoComplete="new-password"
              className="h-11 pl-3.5 pr-10 bg-[#161720] border-[#262835] text-white placeholder:text-zinc-500 rounded-[10px] text-sm focus-visible:border-[#9d4edd] focus-visible:ring-1 focus-visible:ring-[#9d4edd] transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1 focus:outline-none transition-colors"
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-11 sm:h-12 rounded-[10px] bg-[#9d4edd] hover:bg-[#8b5cf6] text-white font-medium text-sm transition-all duration-150 shadow-md shadow-purple-900/20 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Updating password...</span>
            </div>
          ) : (
            <span>Update Password</span>
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
