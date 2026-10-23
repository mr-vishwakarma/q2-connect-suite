import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, CheckCircle2, Shield, GraduationCap, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'react-toastify';

type SignupRole = 'student' | 'admin';

interface SignupProps {
  defaultRole?: SignupRole;
}

export default function Signup({ defaultRole = 'student' }: SignupProps) {
  const [searchParams] = useSearchParams();
  const initialRole: SignupRole = searchParams.get('role') === 'admin' || defaultRole === 'admin' ? 'admin' : 'student';

  const [selectedRole, setSelectedRole] = useState<SignupRole>(initialRole);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [adminSecret, setAdminSecret] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showAdminSecret, setShowAdminSecret] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Field-specific validation errors
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    adminSecret?: string;
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
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (selectedRole === 'admin' && !adminSecret.trim()) {
      newErrors.adminSecret = 'Admin registration secret is required';
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

      const payload: any = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        username,
        role: selectedRole,
      };

      if (selectedRole === 'admin') {
        payload.adminSecret = adminSecret.trim();
      }

      const { error, user } = await signUp(payload);
      setIsLoading(false);

      if (error) {
        const msg = error.message || 'Registration failed';
        setErrors((prev) => ({ ...prev, general: msg }));
        toast.error(msg, { toastId: 'signup-error' });
        return;
      }

      toast.success(
        selectedRole === 'admin'
          ? 'Administrator account provisioned successfully!'
          : 'Account created! Welcome to Hosteliq.',
        { toastId: 'signup-success' }
      );

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
      heading="Create your account"
      subheading="Get started with Hosteliq accommodation platform"
      footer={
        <p>
          Already have an account?{' '}
          <Link
            to={`/login?role=${selectedRole}`}
            className="font-medium text-[#b794f4] hover:text-[#d6bcfa] hover:underline transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#9d4edd] rounded px-1"
          >
            Sign in
          </Link>
        </p>
      }
    >
      {/* Role Selector Segmented Control */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-xs font-medium text-zinc-300 mb-2">
          <Label id="role-selector-label" className="text-xs font-medium text-zinc-300">
            Account Role
          </Label>
          <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
            Verified backend authority
          </span>
        </div>

        <div
          role="radiogroup"
          aria-labelledby="role-selector-label"
          className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#161720] border border-white/[0.08]"
        >
          <button
            type="button"
            role="radio"
            aria-checked={selectedRole === 'student'}
            onClick={() => {
              setSelectedRole('student');
              setErrors((prev) => ({ ...prev, adminSecret: undefined, general: undefined }));
            }}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9d4edd] ${
              selectedRole === 'student'
                ? 'bg-[#251b38] text-white border border-[#9d4edd]/50 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] border border-transparent'
            }`}
          >
            <GraduationCap className={`w-3.5 h-3.5 ${selectedRole === 'student' ? 'text-[#b794f4]' : 'text-zinc-400'}`} />
            <span>Student</span>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={selectedRole === 'admin'}
            onClick={() => {
              setSelectedRole('admin');
              setErrors((prev) => ({ ...prev, general: undefined }));
            }}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9d4edd] ${
              selectedRole === 'admin'
                ? 'bg-[#251b38] text-white border border-[#9d4edd]/50 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] border border-transparent'
            }`}
          >
            <Shield className={`w-3.5 h-3.5 ${selectedRole === 'admin' ? 'text-[#b794f4]' : 'text-zinc-400'}`} />
            <span>Admin</span>
          </button>
        </div>
      </div>

      {/* Role specific context info */}
      {selectedRole === 'student' && (
        <div className="mb-5 p-3 rounded-xl bg-purple-950/20 border border-purple-500/20 flex items-start gap-2.5 text-left text-xs text-purple-200/90 leading-relaxed">
          <Info className="w-4 h-4 text-[#b794f4] shrink-0 mt-0.5" />
          <span>
            Resident student accounts are typically provisioned during room allocation by your property manager.
          </span>
        </div>
      )}

      {/* General error message banner */}
      {errors.general && (
        <div className="mb-4 p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 flex items-start gap-2 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{errors.general}</span>
        </div>
      )}

      {/* Registration Form */}
      <form onSubmit={handleSubmit} className="space-y-4 text-left" noValidate>
        {/* Full Name */}
        <div className="space-y-1.5">
          <Label htmlFor="signup-name" className="text-xs font-medium text-zinc-300">
            Full Name
          </Label>
          <Input
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
            className={`h-11 px-3.5 bg-[#161720] border rounded-[10px] text-sm text-white placeholder:text-zinc-500 transition-colors focus-visible:outline-none ${
              errors.name
                ? 'border-rose-500 focus-visible:border-rose-500 focus-visible:ring-1 focus-visible:ring-rose-500'
                : 'border-[#262835] focus-visible:border-[#9d4edd] focus-visible:ring-1 focus-visible:ring-[#9d4edd]'
            }`}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'signup-name-error' : undefined}
          />
          {errors.name && (
            <p id="signup-name-error" className="text-xs text-rose-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.name}</span>
            </p>
          )}
        </div>

        {/* Email Address */}
        <div className="space-y-1.5">
          <Label htmlFor="signup-email" className="text-xs font-medium text-zinc-300">
            Email Address
          </Label>
          <Input
            id="signup-email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            autoComplete="email"
            required
            className={`h-11 px-3.5 bg-[#161720] border rounded-[10px] text-sm text-white placeholder:text-zinc-500 transition-colors focus-visible:outline-none ${
              errors.email
                ? 'border-rose-500 focus-visible:border-rose-500 focus-visible:ring-1 focus-visible:ring-rose-500'
                : 'border-[#262835] focus-visible:border-[#9d4edd] focus-visible:ring-1 focus-visible:ring-[#9d4edd]'
            }`}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'signup-email-error' : undefined}
          />
          {errors.email && (
            <p id="signup-email-error" className="text-xs text-rose-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.email}</span>
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <Label htmlFor="signup-password" className="text-xs font-medium text-zinc-300">
            Password
          </Label>
          <div className="relative">
            <Input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              autoComplete="new-password"
              required
              className={`h-11 pl-3.5 pr-10 bg-[#161720] border rounded-[10px] text-sm text-white placeholder:text-zinc-500 transition-colors focus-visible:outline-none ${
                errors.password
                  ? 'border-rose-500 focus-visible:border-rose-500 focus-visible:ring-1 focus-visible:ring-rose-500'
                  : 'border-[#262835] focus-visible:border-[#9d4edd] focus-visible:ring-1 focus-visible:ring-[#9d4edd]'
              }`}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'signup-password-error' : undefined}
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
          {errors.password && (
            <p id="signup-password-error" className="text-xs text-rose-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.password}</span>
            </p>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-1.5">
          <Label htmlFor="signup-confirm-password" className="text-xs font-medium text-zinc-300">
            Confirm Password
          </Label>
          <div className="relative">
            <Input
              id="signup-confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="••••••••••••"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
              }}
              autoComplete="new-password"
              required
              className={`h-11 pl-3.5 pr-10 bg-[#161720] border rounded-[10px] text-sm text-white placeholder:text-zinc-500 transition-colors focus-visible:outline-none ${
                errors.confirmPassword
                  ? 'border-rose-500 focus-visible:border-rose-500 focus-visible:ring-1 focus-visible:ring-rose-500'
                  : 'border-[#262835] focus-visible:border-[#9d4edd] focus-visible:ring-1 focus-visible:ring-[#9d4edd]'
              }`}
              aria-invalid={Boolean(errors.confirmPassword)}
              aria-describedby={errors.confirmPassword ? 'signup-confirm-password-error' : undefined}
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
          {errors.confirmPassword && (
            <p id="signup-confirm-password-error" className="text-xs text-rose-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.confirmPassword}</span>
            </p>
          )}
        </div>

        {/* Admin Secret (Only when Admin is selected, enforcing backend authority) */}
        {selectedRole === 'admin' && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="signup-admin-secret" className="text-xs font-medium text-zinc-300">
                Admin Registration Secret
              </Label>
              <span className="text-[10px] text-amber-400 font-medium">Required for Admin</span>
            </div>
            <div className="relative">
              <Input
                id="signup-admin-secret"
                type={showAdminSecret ? 'text' : 'password'}
                placeholder="Enter secret configured on backend"
                value={adminSecret}
                onChange={(e) => {
                  setAdminSecret(e.target.value);
                  if (errors.adminSecret) setErrors((prev) => ({ ...prev, adminSecret: undefined }));
                }}
                autoComplete="off"
                required
                className={`h-11 pl-3.5 pr-10 bg-[#161720] border rounded-[10px] text-sm text-white placeholder:text-zinc-500 transition-colors focus-visible:outline-none ${
                  errors.adminSecret
                    ? 'border-rose-500 focus-visible:border-rose-500 focus-visible:ring-1 focus-visible:ring-rose-500'
                    : 'border-[#262835] focus-visible:border-[#9d4edd] focus-visible:ring-1 focus-visible:ring-[#9d4edd]'
                }`}
                aria-invalid={Boolean(errors.adminSecret)}
                aria-describedby={errors.adminSecret ? 'signup-admin-secret-error' : undefined}
              />
              <button
                type="button"
                onClick={() => setShowAdminSecret(!showAdminSecret)}
                aria-label={showAdminSecret ? 'Hide admin secret' : 'Show admin secret'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1 focus:outline-none transition-colors"
              >
                {showAdminSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.adminSecret && (
              <p id="signup-admin-secret-error" className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errors.adminSecret}</span>
              </p>
            )}
          </div>
        )}

        {/* Primary CTA Submit Button */}
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-11 sm:h-12 rounded-[10px] bg-[#9d4edd] hover:bg-[#8b5cf6] text-white font-medium text-sm transition-all duration-150 shadow-md shadow-purple-900/20 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Creating account...</span>
            </div>
          ) : (
            <span>Create account</span>
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
