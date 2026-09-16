import { lazy, Suspense } from 'react';

const BuildingBackgroundCanvas = lazy(() => import('./BuildingBackgroundCanvas'));

interface BuildingBackgroundProps {
  showOnHome?: boolean;
}

export function BuildingBackground({ showOnHome = false }: BuildingBackgroundProps) {
  if (!showOnHome) return null;

  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background/60 z-10" />
        </div>
      }
    >
      <BuildingBackgroundCanvas />
    </Suspense>
  );
}
