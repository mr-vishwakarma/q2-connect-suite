import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, AlertCircle } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { api } from '@/lib/api';
import { toast } from 'react-toastify';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim()) {
      setErrorMsg('Please enter your email address or user ID');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/auth/password/forgot', { email: email.trim() });
      if (response.data?.success) {
        setIsSubmitted(true);
      } else {
        const msg = response.data?.message || 'Unable to process password reset. Please try again.';
        setErrorMsg(msg);
        toast.error(msg);
      }
    } catch (error: any) {
      const serverMessage =
        error.response?.data?.message ||
        error.response?.data?.error?.message ||
        (typeof error.response?.data === 'string' && error.response.data.length < 200 ? error.response.data : null);

      if (serverMessage) {
        setErrorMsg(serverMessage);
        toast.error(serverMessage);
      } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        setIsSubmitted(true);
      } else if (error.code === 'ERR_NETWORK') {
        const msg = 'Network error: Unable to reach the server. Please check your internet connection.';
        setErrorMsg(msg);
        toast.error(msg);
      } else {
        const msg = 'Something went wrong. Please try again later.';
        setErrorMsg(msg);
        toast.error(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <AuthLayout
        heading="Check your email"
        subheading="Password reset instructions dispatched"
        variant="default"
        glowColor="purple"
        footer={
          <p>
            Remembered your credentials?{' '}
            <Link
              to="/login"
              className="font-semibold text-purple-400 hover:text-purple-300 hover:underline transition-colors"
            >
              Sign in
            </Link>
          </p>
        }
      >
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto">
            <Mail className="w-7 h-7" />
          </div>

          <p className="text-xs text-zinc-300 leading-relaxed">
            If an account exists with <strong className="text-white">{email}</strong>, we have sent instructions to reset your password.
          </p>

          <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/20 text-left text-xs text-purple-200/90 leading-relaxed">
            💡 <strong>Tip:</strong> Please check your <strong>Spam / Junk</strong> folder if the link does not appear in your main inbox within a few minutes.
          </div>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full h-12 rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] hover:from-[#9d4edd] hover:to-[#8b5cf6] text-white font-semibold text-sm transition-all shadow-[0_0_20px_rgba(139,92,246,0.35)]"
          >
            Return to Login
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      heading="Reset Password"
      subheading="Enter your email address or user ID to receive a password reset link"
      variant="default"
      glowColor="purple"
      footer={
        <p>
          Remember your password?{' '}
          <Link
            to="/login"
            className="font-semibold text-purple-400 hover:text-purple-300 hover:underline transition-colors"
          >
            Sign in
          </Link>
        </p>
      }
    >
      {errorMsg && (
        <div className="mb-4 p-3 rounded-2xl bg-rose-950/40 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-left" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="forgot-email" className="text-xs font-medium text-zinc-300 block">
            Email Address or User ID
          </label>
          <input
            id="forgot-email"
            type="text"
            placeholder="resident@example.com or username"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            required
            autoComplete="username"
            className="w-full h-12 px-4 rounded-2xl bg-[#181926]/90 border border-white/[0.08] focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/15 text-sm text-white placeholder:text-zinc-500 outline-none transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-12 rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] hover:from-[#9d4edd] hover:to-[#8b5cf6] text-white font-semibold text-sm transition-all shadow-[0_0_20px_rgba(139,92,246,0.35)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Sending reset link...</span>
            </div>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <span>Send Reset Link</span>
              <ArrowRight className="w-4 h-4" />
            </span>
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
