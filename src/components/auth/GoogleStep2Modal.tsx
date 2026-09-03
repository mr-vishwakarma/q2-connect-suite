import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'react-toastify';
import { Eye, EyeOff, User, Lock, CheckCircle2, Sparkles, ArrowRight } from 'lucide-react';

interface GoogleStep2ModalProps {
  isOpen: boolean;
  setupToken: string;
  googleProfile: {
    email: string;
    name: string;
    picture?: string;
    suggestedUsername?: string;
  };
  onSuccess: (user: any) => void;
  onCancel: () => void;
}

export function GoogleStep2Modal({
  isOpen,
  setupToken,
  googleProfile,
  onSuccess,
  onCancel,
}: GoogleStep2ModalProps) {
  const { completeGoogleSetup } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (googleProfile?.suggestedUsername) {
      setUsername(googleProfile.suggestedUsername);
    }
  }, [googleProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim()) {
      toast.error('Please choose a username');
      return;
    }
    if (username.length < 3) {
      toast.error('Username must be at least 3 characters long');
      return;
    }
    if (!password) {
      toast.error('Please set a password');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const { error, user } = await completeGoogleSetup({
        setupToken,
        username: username.trim(),
        password,
      });

      setIsLoading(false);

      if (error) {
        toast.error(error.message || 'Setup failed. Please try again.');
      } else {
        toast.success(`Welcome to Q2, ${user?.name || 'Resident'}! Setup complete.`);
        onSuccess(user);
      }
    } catch (err: any) {
      setIsLoading(false);
      toast.error(err?.message || 'Profile setup failed');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-[460px] p-0 overflow-hidden bg-card border-border/80 shadow-2xl rounded-2xl">
        {/* Top Gradient Banner */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-primary p-6 text-white text-left relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-12 -mt-12 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center gap-3 relative z-10">
            {googleProfile.picture ? (
              <img
                src={googleProfile.picture}
                alt={googleProfile.name}
                className="w-12 h-12 rounded-full border-2 border-white/80 shadow-md object-cover shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg">
                {googleProfile.name?.[0] || 'R'}
              </div>
            )}
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-semibold mb-1 backdrop-blur-sm">
                <CheckCircle2 className="w-3 h-3 text-emerald-200" />
                <span>Admin Approved • Verified Resident</span>
              </div>
              <h3 className="text-lg font-bold leading-tight">Step 2: Choose Username & Password</h3>
              <p className="text-xs text-emerald-100 opacity-90 truncate max-w-[280px]">
                {googleProfile.email}
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-left">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-muted-foreground flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <span>
              Your registration is approved! Choose your login credentials. You can log in with this username/password or with 1-click Google anytime.
            </span>
          </div>

          {/* Username Input */}
          <div className="space-y-1">
            <Label htmlFor="setup-username" className="text-xs font-semibold">
              Choose Username
            </Label>
            <div className="relative">
              <User className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
              <Input
                id="setup-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                placeholder="e.g. priya_q2"
                className="pl-9 h-10"
                required
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1">
            <Label htmlFor="setup-password" className="text-xs font-semibold">
              Create Password
            </Label>
            <div className="relative">
              <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
              <Input
                id="setup-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="pl-9 pr-9 h-10"
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

          {/* Confirm Password */}
          <div className="space-y-1">
            <Label htmlFor="setup-confirm-password" className="text-xs font-semibold">
              Confirm Password
            </Label>
            <div className="relative">
              <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
              <Input
                id="setup-confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="pl-9 h-10"
                required
              />
            </div>
          </div>

          {/* Submit CTA */}
          <div className="pt-3">
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md text-xs rounded-xl"
            >
              {isLoading ? (
                'Configuring Profile...'
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  <span>Complete Setup & Enter Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
