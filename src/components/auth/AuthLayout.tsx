import React from 'react';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
  children: React.ReactNode;
  heading?: string;
  subheading?: string;
  footer?: React.ReactNode;
  variant?: 'login' | 'signup' | 'default';
  glowColor?: 'coral' | 'purple' | 'auto';
  headingInside?: boolean;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  heading,
  subheading,
  footer,
  variant = 'default',
  glowColor = 'auto',
  headingInside = true,
}) => {
  const activeGlow =
    glowColor === 'auto'
      ? variant === 'login'
        ? 'coral'
        : variant === 'signup'
        ? 'purple'
        : 'default'
      : glowColor;

  return (
    <div className="min-h-screen w-full bg-[#08090d] text-white flex flex-col justify-center items-center px-4 py-8 sm:py-12 selection:bg-rose-500/30 relative overflow-hidden">
      {/* Background ambient lighting */}
      {activeGlow === 'coral' && (
        <>
          <div
            className="pointer-events-none absolute -top-40 -left-40 w-[600px] h-[600px] bg-gradient-to-br from-rose-600/[0.12] via-red-600/[0.04] to-transparent blur-[120px] rounded-full"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute top-1/2 -right-40 w-[500px] h-[500px] bg-gradient-to-bl from-orange-500/[0.05] to-transparent blur-[140px] rounded-full"
            aria-hidden="true"
          />
        </>
      )}

      {activeGlow === 'purple' && (
        <>
          <div
            className="pointer-events-none absolute -top-40 -right-40 w-[600px] h-[600px] bg-gradient-to-bl from-purple-600/[0.15] via-indigo-600/[0.05] to-transparent blur-[120px] rounded-full"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute bottom-0 -left-40 w-[500px] h-[500px] bg-gradient-to-tr from-purple-900/[0.08] to-transparent blur-[140px] rounded-full"
            aria-hidden="true"
          />
        </>
      )}

      {activeGlow === 'default' && (
        <div
          className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-purple-600/[0.06] to-transparent blur-3xl"
          aria-hidden="true"
        />
      )}

      <div className="w-full max-w-[440px] relative z-10 mx-auto">
        {/* Brand Logo Header */}
        <div className="flex flex-col items-center mb-5 text-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center mb-2 transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 rounded-2xl p-1.5"
            aria-label="Hosteliq Home"
          >
            <img
              src="/hosteliq-logo.png"
              alt="Hosteliq"
              width={48}
              height={48}
              className="h-11 w-auto object-contain drop-shadow-[0_4px_16px_rgba(255,255,255,0.12)]"
              loading="eager"
            />
          </Link>

          {!headingInside && heading && (
            <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
              {heading}
            </h1>
          )}
          {!headingInside && subheading && (
            <p className="text-xs text-zinc-400 mt-1 max-w-[340px]">
              {subheading}
            </p>
          )}
        </div>

        {/* Sleek Glassmorphic Card Container with Specular Edge & Glow */}
        <div className="relative rounded-[32px] sm:rounded-[36px] bg-[#12131d]/85 backdrop-blur-2xl border border-white/[0.12] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] p-6 sm:p-9 overflow-hidden">
          {/* Specular top border reflection highlight */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent"
            aria-hidden="true"
          />

          {/* Corner Ambient Glows inside the Card */}
          {activeGlow === 'coral' && (
            <div
              className="pointer-events-none absolute -top-14 -left-14 w-44 h-44 bg-gradient-to-br from-rose-500/30 to-red-600/5 blur-2xl rounded-full"
              aria-hidden="true"
            />
          )}

          {activeGlow === 'purple' && (
            <div
              className="pointer-events-none absolute -top-14 -right-14 w-48 h-48 bg-gradient-to-bl from-purple-500/25 to-indigo-600/5 blur-2xl rounded-full"
              aria-hidden="true"
            />
          )}

          <div className="relative z-10">
            {headingInside && heading && (
              <div className="text-center mb-6">
                <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-white leading-tight">
                  {heading}
                </h1>
                {subheading && (
                  <p className="text-xs sm:text-sm text-zinc-400 mt-1.5">
                    {subheading}
                  </p>
                )}
              </div>
            )}

            {children}
          </div>
        </div>

        {/* Footer Link / Info */}
        {footer && (
          <div className="mt-5 text-center text-xs text-zinc-400">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
