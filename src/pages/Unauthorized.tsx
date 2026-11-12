import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ShieldX, Home, LogIn, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { HosteliqLogo } from '@/components/common/HosteliqLogo';

export default function Unauthorized() {
  const { user, isSuperAdmin, isAdmin } = useAuth();

  const portalPath = user
    ? isSuperAdmin || user.role === 'super_admin'
      ? '/super-admin/dashboard'
      : isAdmin || user.role === 'admin'
      ? '/admin/dashboard'
      : '/student/dashboard'
    : '/login';

  return (
    <div className="relative min-h-screen app-shell-bg overflow-x-hidden flex flex-col items-center justify-center px-4 py-12 text-foreground">
      {/* Subtle ambient glow matching Dark Glass design system */}
      <div
        className="pointer-events-none fixed -top-32 -left-32 w-[420px] h-[420px] rounded-full blur-3xl opacity-50"
        style={{
          background:
            'radial-gradient(circle, rgba(167,139,250,0.20) 0%, rgba(237,145,193,0.08) 45%, transparent 72%)',
        }}
        aria-hidden="true"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="glass-card-highlight rounded-2xl border border-destructive/25 p-6 sm:p-8 text-center">
          <div className="mb-6 flex justify-center">
            <HosteliqLogo variant="wordmark" size="md" />
          </div>

          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/15 border border-destructive/30 text-destructive">
            <ShieldX className="h-7 w-7" />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-[#F0EFF8]">
            Access Denied
          </h1>
          <p className="mt-2 text-sm text-[#9295AD]">
            You do not have the required permissions or authoritative role to access this portal or resource.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            {user ? (
              <Button asChild className="w-full gap-2">
                <Link to={portalPath}>
                  <Home className="w-4 h-4" />
                  Return to Your Authorized Portal
                </Link>
              </Button>
            ) : (
              <Button asChild className="w-full gap-2">
                <Link to="/login">
                  <LogIn className="w-4 h-4" />
                  Go to Login
                </Link>
              </Button>
            )}

            <Button asChild variant="outline" className="w-full gap-2">
              <Link to="/login">
                <LogIn className="w-4 h-4" />
                Sign In with Different Role
              </Link>
            </Button>

            <Button asChild variant="ghost" className="w-full gap-2 text-xs text-muted-foreground">
              <Link to="/">
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Home Page
              </Link>
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
