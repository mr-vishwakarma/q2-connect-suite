import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface AppSplashScreenProps {
  visible: boolean;
}

/**
 * Initial application boot & session resolution splash screen.
 * Displays the official Hosteliq logo on deep charcoal with restrained ambient lighting.
 * Respects prefers-reduced-motion and never blocks UI beyond initial boot.
 */
export function AppSplashScreen({ visible }: AppSplashScreenProps) {
  const [shouldRender, setShouldRender] = useState(visible);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      setFadingOut(false);
      return;
    }

    setFadingOut(true);
    const timer = window.setTimeout(() => {
      setShouldRender(false);
    }, 240);

    return () => window.clearTimeout(timer);
  }, [visible]);

  if (!shouldRender) return null;

  return (
    <div
      role="status"
      aria-label="Loading Hosteliq"
      aria-live="polite"
      className={cn(
        'fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#090B12] transition-opacity duration-300 select-none pointer-events-none',
        fadingOut ? 'opacity-0' : 'opacity-100'
      )}
    >
      {/* Subtle purple-blue ambient glow */}
      <div
        className="pointer-events-none absolute w-[320px] h-[320px] sm:w-[440px] sm:h-[440px] rounded-full blur-3xl opacity-60"
        style={{
          background:
            'radial-gradient(circle, rgba(167,139,250,0.22) 0%, rgba(114,130,235,0.10) 42%, rgba(9,11,18,0) 72%)',
        }}
        aria-hidden="true"
      />

      {/* Centered official Hosteliq logo */}
      <div className="relative z-10 flex flex-col items-center gap-5 px-6">
        <div className="motion-safe:animate-[splashReveal_0.55s_cubic-bezier(0.22,1,0.36,1)_both]">
          <img
            src="/hosteliq-logo.png"
            alt="Hosteliq"
            className="h-16 sm:h-20 w-auto object-contain drop-shadow-[0_12px_36px_rgba(167,139,250,0.28)]"
            loading="eager"
            decoding="sync"
          />
        </div>

        {/* Minimal progress bar indicator */}
        <div className="w-32 h-1 rounded-full bg-white/[0.07] overflow-hidden">
          <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-[#A78BFA] via-[#ED91C1] to-[#74DCCB] motion-safe:animate-[splashBar_1.2s_ease-in-out_infinite] motion-reduce:w-full" />
        </div>
      </div>

      <style>{`
        @keyframes splashReveal {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes splashBar {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(100%);
          }
          100% {
            transform: translateX(220%);
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Lightweight inline loader for lazy route chunks & guarded transitions after initial boot.
 */
export function PortalRouteLoader() {
  return (
    <div className="flex min-h-[60vh] h-full w-full items-center justify-center bg-transparent">
      <div className="flex flex-col items-center gap-3">
        <div className="relative flex items-center justify-center">
          <div className="w-11 h-11 rounded-full border-2 border-[#A78BFA]/20 border-t-[#A78BFA] motion-safe:animate-spin" />
          <img
            src="/favicon.svg"
            alt=""
            className="w-5 h-5 object-contain absolute"
            aria-hidden="true"
          />
        </div>
        <span className="text-xs font-medium text-[#9295AD]">Loading workspace...</span>
      </div>
    </div>
  );
}
