import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
        // If client timeout occurred, the server already processed and saved the token
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
        footer={
          <p>
            Remembered your credentials?{' '}
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
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-[#b794f4] flex items-center justify-center mx-auto">
            <Mail className="w-6 h-6" />
          </div>

          <p className="text-xs text-zinc-300 leading-relaxed">
            If an account exists with <strong className="text-white">{email}</strong>, we have sent instructions to reset your password.
          </p>

          <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/20 text-left text-xs text-purple-200/90 leading-relaxed">
            💡 <strong>Tip:</strong> Please check your <strong>Spam / Junk</strong> folder if the link does not appear in your main inbox within a few minutes.
          </div>

          <Button
            onClick={() => navigate('/login')}
            className="w-full h-11 rounded-[10px] bg-[#9d4edd] hover:bg-[#8b5cf6] text-white font-medium text-sm transition-all shadow-md shadow-purple-900/20"
          >
            Return to Login
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      heading="Reset password"
      subheading="Enter your email address or user ID to receive a password reset link"
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

      <form onSubmit={handleSubmit} className="space-y-4 text-left" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="forgot-email" className="text-xs font-medium text-zinc-300">
            Email Address or User ID
          </Label>
          <Input
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
            className="h-11 px-3.5 bg-[#161720] border-[#262835] text-white placeholder:text-zinc-500 rounded-[10px] text-sm focus-visible:border-[#9d4edd] focus-visible:ring-1 focus-visible:ring-[#9d4edd] transition-colors"
          />
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-11 sm:h-12 rounded-[10px] bg-[#9d4edd] hover:bg-[#8b5cf6] text-white font-medium text-sm transition-all duration-150 shadow-md shadow-purple-900/20 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
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
        </Button>
      </form>
    </AuthLayout>
  );
}
