import React from 'react';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
  children: React.ReactNode;
  heading: string;
  subheading?: string;
  footer?: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  heading,
  subheading,
  footer,
}) => {
  return (
    <div className="min-h-screen w-full bg-[#090909] text-white flex flex-col justify-center items-center px-4 py-8 sm:py-12 selection:bg-[#9d4edd]/30 relative overflow-hidden">
      {/* Subtle ambient gradient hint at top center */}
      <div 
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-[#9d4edd]/[0.04] to-transparent blur-3xl" 
        aria-hidden="true" 
      />

      <div className="w-full max-w-[420px] relative z-10 mx-auto">
        {/* Minimal Brand Header */}
        <div className="flex flex-col items-center mb-6 text-center">
          <Link 
            to="/" 
            className="inline-flex items-center justify-center mb-3 transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9d4edd]/60 rounded-xl p-1"
            aria-label="Hosteliq Home"
          >
            <img
              src="/hosteliq-logo.png"
              alt="Hosteliq"
              width={40}
              height={40}
              className="h-10 w-auto object-contain"
              loading="eager"
            />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {heading}
          </h1>
          {subheading && (
            <p className="text-xs text-zinc-400 mt-1 max-w-[340px]">
              {subheading}
            </p>
          )}
        </div>

        {/* Minimal Centered Card Container */}
        <div className="rounded-2xl bg-[#111217] border border-white/[0.08] shadow-2xl shadow-black/80 p-6 sm:p-7 backdrop-blur-sm">
          {children}
        </div>

        {/* Footer Navigation Link */}
        {footer && (
          <div className="mt-5 text-center text-xs text-zinc-400">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
