import { useEffect, useRef, useState, useCallback } from 'react';

const TOTAL_FRAMES = 240;
const FRAME_WIDTH = 405;
const FRAME_HEIGHT = 720;

const getFrameUrl = (index: number) => {
  const frameNumber = String(index + 1).padStart(3, '0');
  return `/sequence/ezgif-frame-${frameNumber}.png`;
};

export function ScrollSequenceSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Array holding HTMLImageElement instances
  const imagesRef = useRef<(HTMLImageElement | null)[]>(new Array(TOTAL_FRAMES).fill(null));
  const loadedFramesRef = useRef<boolean[]>(new Array(TOTAL_FRAMES).fill(false));
  const lastRenderedIndexRef = useRef<number>(0);
  const activeLoadIndexRef = useRef<number>(0);

  const [isLoadingFirstFrame, setIsLoadingFirstFrame] = useState(true);
  const [loadProgressPercent, setLoadProgressPercent] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Single Frame Drawer
  const drawFrame = useCallback((targetIndex: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Determine which image to draw: target frame if ready, or nearest available fallback
    let imgToDraw: HTMLImageElement | null = null;
    if (imagesRef.current[targetIndex] && loadedFramesRef.current[targetIndex]) {
      imgToDraw = imagesRef.current[targetIndex];
      lastRenderedIndexRef.current = targetIndex;
    } else {
      // Find nearest loaded frame to prevent any blank frames during rapid scrubbing
      const lastIdx = lastRenderedIndexRef.current;
      if (imagesRef.current[lastIdx] && loadedFramesRef.current[lastIdx]) {
        imgToDraw = imagesRef.current[lastIdx];
      } else {
        // Search outward
        for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
          const prev = targetIndex - offset;
          const next = targetIndex + offset;
          if (prev >= 0 && loadedFramesRef.current[prev] && imagesRef.current[prev]) {
            imgToDraw = imagesRef.current[prev];
            break;
          }
          if (next < TOTAL_FRAMES && loadedFramesRef.current[next] && imagesRef.current[next]) {
            imgToDraw = imagesRef.current[next];
            break;
          }
        }
      }
    }

    if (!imgToDraw) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    // Cap devicePixelRatio at 2 to balance crispness with mobile GPU memory
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const physicalWidth = Math.round(viewportWidth * dpr);
    const physicalHeight = Math.round(viewportHeight * dpr);

    if (canvas.width !== physicalWidth || canvas.height !== physicalHeight) {
      canvas.width = physicalWidth;
      canvas.height = physicalHeight;
      canvas.style.width = `${viewportWidth}px`;
      canvas.style.height = `${viewportHeight}px`;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    // Clear canvas to preserve alpha transparency against the white background
    ctx.clearRect(0, 0, viewportWidth, viewportHeight);

    // Calculate aspect-ratio-preserving display dimensions
    const isMobile = viewportWidth < 640;
    const paddingFactor = isMobile ? 0.94 : 0.88;

    const scale = Math.min(
      (viewportWidth * paddingFactor) / FRAME_WIDTH,
      (viewportHeight * paddingFactor) / FRAME_HEIGHT
    );

    const drawWidth = Math.round(FRAME_WIDTH * scale);
    const drawHeight = Math.round(FRAME_HEIGHT * scale);
    const drawX = Math.round((viewportWidth - drawWidth) / 2);
    const drawY = Math.round((viewportHeight - drawHeight) / 2);

    ctx.drawImage(imgToDraw, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();
  }, []);

  // Preload a single frame
  const loadFrame = useCallback((index: number): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      if (imagesRef.current[index] && loadedFramesRef.current[index]) {
        resolve(imagesRef.current[index]!);
        return;
      }

      const img = new Image();
      img.src = getFrameUrl(index);
      img.decoding = 'async';

      img.onload = () => {
        imagesRef.current[index] = img;
        loadedFramesRef.current[index] = true;
        resolve(img);
      };

      img.onerror = (err) => {
        reject(err);
      };
    });
  }, []);

  // Priority-based progressive loader
  const startProgressiveLoad = useCallback(() => {
    let loadedCount = 0;
    const totalToLoad = TOTAL_FRAMES;

    // Load in concurrent batches to avoid network congestion
    const CONCURRENCY = 8;
    let nextIndexToLoad = 0;

    const loadNext = () => {
      if (nextIndexToLoad >= totalToLoad) return;
      const currentIndex = nextIndexToLoad++;

      loadFrame(currentIndex)
        .then(() => {
          loadedCount++;
          const percent = Math.round((loadedCount / totalToLoad) * 100);
          setLoadProgressPercent(percent);
          loadNext();
        })
        .catch(() => {
          // Retry or proceed
          loadNext();
        });
    };

    for (let c = 0; c < CONCURRENCY; c++) {
      loadNext();
    }
  }, [loadFrame]);

  // Initial setup: Load Frame 1 immediately and start progressive loading on idle / intersection
  useEffect(() => {
    // 1. Immediately load frame 0 (first frame) and draw it
    loadFrame(0).then(() => {
      setIsLoadingFirstFrame(false);
      drawFrame(0);
    });

    // 2. Also load the final frame (index 239) early for reduced motion and end-state readiness
    loadFrame(TOTAL_FRAMES - 1).catch(() => {});

    // 3. Setup IntersectionObserver to start full sequence buffering as container approaches viewport
    const container = containerRef.current;
    if (!container) return;

    let hasStartedLoading = false;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !hasStartedLoading) {
          hasStartedLoading = true;
          startProgressiveLoad();
        }
      },
      { rootMargin: '600px 0px' }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [loadFrame, drawFrame, startProgressiveLoad]);

  // Scroll scrub listener
  useEffect(() => {
    if (prefersReducedMotion) return;

    let rafId: number | null = null;

    const handleScrollOrResize = () => {
      if (rafId !== null) return;

      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const scrollDistance = rect.height - window.innerHeight;

        if (scrollDistance <= 0) return;

        // Progress from 0 (entry) to 1 (exit of sticky phase)
        const rawProgress = -rect.top / scrollDistance;
        const clampedProgress = Math.max(0, Math.min(1, rawProgress));

        // Proportional frame mapping: 0 -> frame 0, 1 -> frame 239
        const targetFrame = Math.min(
          TOTAL_FRAMES - 1,
          Math.max(0, Math.round(clampedProgress * (TOTAL_FRAMES - 1)))
        );

        drawFrame(targetFrame);
      });
    };

    window.addEventListener('scroll', handleScrollOrResize, { passive: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });

    // Initial draw pass
    handleScrollOrResize();

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize);
      window.removeEventListener('resize', handleScrollOrResize);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [drawFrame, prefersReducedMotion]);

  return (
    <section
      ref={containerRef}
      className="relative w-full bg-white text-slate-900"
      style={{
        // 420vh scroll distance gives the 240 frames natural, smooth scrub pacing
        height: prefersReducedMotion ? '100vh' : '420vh',
      }}
      aria-label="Architectural Sequence Scroll Animation"
    >
      {/* 
        Sticky Viewport Stage:
        Remains pinned in place (100dvh) while the outer 420vh container scrolls past.
      */}
      <div className="sticky top-0 h-[100dvh] w-full flex items-center justify-center overflow-hidden bg-white select-none pointer-events-none">
        {/* HTML Canvas for Scrubbed Sequence Rendering */}
        {!prefersReducedMotion ? (
          <canvas
            ref={canvasRef}
            className="block max-w-full max-h-full object-contain pointer-events-none z-10 transition-opacity duration-300"
            style={{
              opacity: isLoadingFirstFrame ? 0 : 1,
            }}
          />
        ) : (
          /* Reduced-motion static poster fallback (Phase 10 requirement) */
          <div className="flex items-center justify-center w-full h-full p-4">
            <img
              src={getFrameUrl(TOTAL_FRAMES - 1)}
              alt="Hosteliq Architectural Model"
              className="max-h-[85vh] w-auto object-contain"
            />
          </div>
        )}

        {/* Minimal initial frame preloader indicator */}
        {isLoadingFirstFrame && !prefersReducedMotion && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white z-20">
            <div className="w-8 h-8 border-3 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* 
        Phase 9: Animation Completion & End State
        Clean white buffer zone following the sticky scroll sequence.
        When the user scrolls past the 420vh container, this ensures the last frame releases
        smoothly into a pristine white background.
      */}
      <div className="w-full h-[40vh] sm:h-[50vh] bg-white pointer-events-none" />
    </section>
  );
}
