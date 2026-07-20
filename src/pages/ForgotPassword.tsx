import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, ArrowRight, Shield } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/auth/request-reset', { email: email.trim() });
      if (response.data?.success) {
        setIsSubmitted(true);
      }
    } catch (error: any) {
      // Show error but maybe fallback to success state to prevent email enumeration
      toast.error(error.response?.data?.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
        
        <div className="sm:mx-auto sm:w-full sm:max-w-md relative">
          <Card className="bg-card border-border">
            <CardContent className="p-6 text-center">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
                <Mail className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Check Your Email</h2>
              <p className="text-muted-foreground mb-6">
                If an account exists with {email}, we've sent instructions to reset your password.
              </p>
              <Button onClick={() => navigate('/login')} className="w-full">
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
            Forgot Password
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your email to receive a password reset link.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-8"
        >
          <Card className="bg-card border-border shadow-2xl">
            <CardContent className="pt-6">
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@example.com"
                      required
                      className="pl-10 bg-secondary border-border"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full text-base font-semibold shadow-lg hover:shadow-primary/25 transition-all duration-300"
                  disabled={isLoading}
                >
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                  {!isLoading && <ArrowRight className="ml-2 w-4 h-4" />}
                </Button>

                <div className="text-center mt-4">
                  <Link
                    to="/login"
                    className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    Back to Login
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
