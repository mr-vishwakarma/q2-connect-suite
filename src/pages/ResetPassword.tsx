import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Key, Eye, EyeOff, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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
  const { signOut } = useAuth();

  // Ensure any existing sessions (like an admin session) are cleared 
  // so the user starts fresh and auto-login works cleanly.
  useEffect(() => {
    signOut();
  }, [signOut]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token) {
      toast.error('Invalid or missing reset token');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 6) {
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
        toast.error(error.response?.data?.message || 'Failed to reset password. If your link expired, please request a new one.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/10 via-background to-background" />
        
        <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="mx-auto w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              Password Reset Complete! 🎉
            </h2>
            <p className="mt-2 text-sm text-muted-foreground font-medium">
              Your password has been reset. You can continue to log in.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-8"
          >
            <Card className="bg-card border-border shadow-2xl">
              <CardContent className="p-6 text-center space-y-5">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm text-left space-y-2">
                  <div className="flex items-center gap-2 font-medium text-emerald-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Account Security Verified</span>
                  </div>
                  <ul className="text-xs text-emerald-300/80 space-y-1 list-disc list-inside">
                    <li>Your new password is now active</li>
                    <li>Previous sessions have been invalidated for security</li>
                    <li>Sign in with your User ID / Email and new password</li>
                  </ul>
                </div>

                <div className="space-y-3 pt-2">
                  <Button
                    onClick={() => {
                      // Fresh window navigation prevents stale cached chunks after new deployment
                      window.location.href = '/login';
                    }}
                    className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-600/20 gap-2"
                  >
                    <span>Continue to Login</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      window.location.href = '/';
                    }}
                    className="w-full h-10 border-border hover:bg-secondary text-xs"
                  >
                    Return to Home
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <Card className="bg-card border-border">
            <CardContent className="p-6 text-center">
              <h2 className="text-2xl font-bold text-destructive mb-2">Invalid or Missing Link</h2>
              <p className="text-muted-foreground mb-4">
                This password reset link is invalid or has expired. Please request a new link from the Forgot Password page.
              </p>
              <Button onClick={() => navigate('/forgot-password')} className="w-full mb-2">
                Request New Reset Link
              </Button>
              <Button variant="outline" onClick={() => navigate('/login')} className="w-full">
                Return to Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-3xl font-extrabold text-foreground tracking-tight">
            Reset Password
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Please enter your new password below.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-8"
        >
          <Card className="bg-card border-border shadow-2xl">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl text-center text-foreground font-semibold">
                Set New Password
              </CardTitle>
            </CardHeader>
            <CardContent>
              {expiredNotice && (
                <div className="mb-5 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm">
                  <p className="font-semibold mb-1 flex items-center gap-1.5">
                    <span>📬</span> Fresh Reset Link Sent
                  </p>
                  <p className="text-xs text-blue-300 leading-relaxed mb-3">
                    {expiredNotice}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/login')}
                    className="w-full text-xs border-blue-500/40 hover:bg-blue-500/20"
                  >
                    Return to Login
                  </Button>
                </div>
              )}
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Key className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter new password"
                      required
                      className="pl-10 pr-10 bg-secondary border-border"
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Key className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      required
                      className="pl-10 pr-10 bg-secondary border-border"
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full text-base font-semibold shadow-lg hover:shadow-primary/25 transition-all duration-300"
                  disabled={isLoading}
                >
                  {isLoading ? 'Resetting...' : 'Reset Password'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
