import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export function OfflineBanner() {
  const { isOnline, wasOffline } = useNetworkStatus();
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowRestored(true);
      const timer = setTimeout(() => {
        setShowRestored(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (!isOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-950 font-medium text-xs py-1.5 px-4 flex items-center justify-center gap-2 shadow-md transition-all animate-in slide-in-from-top duration-200"
      >
        <WifiOff className="w-3.5 h-3.5 shrink-0" />
        <span>You are currently offline. Application is running in offline mode.</span>
      </div>
    );
  }

  if (showRestored) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed top-0 left-0 right-0 z-50 bg-emerald-600 text-white font-medium text-xs py-1.5 px-4 flex items-center justify-center gap-2 shadow-md transition-all animate-in slide-in-from-top duration-200"
      >
        <Wifi className="w-3.5 h-3.5 shrink-0" />
        <span>Internet connection restored. Back online.</span>
      </div>
    );
  }

  return null;
}
