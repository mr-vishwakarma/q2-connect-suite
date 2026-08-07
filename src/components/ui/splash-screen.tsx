import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';

interface SplashScreenProps {
  onFinish: () => void;
}

export function SplashScreen({ onFinish }: SplashScreenProps) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    // 3 seconds total display before fading out
    const timer = setTimeout(() => {
      setShow(false);
      setTimeout(onFinish, 1000); // 1 second fade out duration
    }, 3000); 
    return () => clearTimeout(timer);
  }, [onFinish]);

  // Generate 30 dust particles
  const particles = Array.from({ length: 30 }).map((_, i) => ({
    id: i,
    size: Math.random() * 4 + 2,
    x: Math.random() * 100,
    y: Math.random() * 100,
    duration: Math.random() * 3 + 2,
    delay: Math.random() * 1,
  }));

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        >
          {/* Background Image with Cinematic Ken Burns Effect */}
          <motion.div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-70"
            style={{ backgroundImage: "url('/splash-bg.png')" }}
            initial={{ scale: 1, filter: 'brightness(0.6)' }}
            animate={{ scale: 1.15, filter: 'brightness(0.9)' }}
            transition={{ duration: 4, ease: "easeOut" }}
          />

          {/* Volumetric Dust Particles Overlay */}
          <div className="absolute inset-0 pointer-events-none">
            {particles.map((p) => (
              <motion.div
                key={p.id}
                className="absolute rounded-full bg-white opacity-40 blur-[1px]"
                style={{
                  width: p.size,
                  height: p.size,
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                }}
                animate={{
                  y: [0, -50, -100],
                  x: [0, Math.random() * 20 - 10, Math.random() * 40 - 20],
                  opacity: [0, 0.6, 0],
                }}
                transition={{
                  duration: p.duration,
                  repeat: Infinity,
                  delay: p.delay,
                  ease: "linear",
                }}
              />
            ))}
          </div>

          {/* Brand Overlay with Staggered Entrance */}
          <motion.div 
            className="relative z-10 flex flex-col items-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 1, ease: "easeOut" }}
          >
            <motion.div 
              className="bg-primary/30 p-5 rounded-3xl backdrop-blur-md border border-primary/50 mb-5 shadow-[0_0_40px_rgba(var(--primary),0.4)]"
              initial={{ scale: 0.8, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.7, type: "spring", stiffness: 100 }}
            >
              <Building2 className="w-16 h-16 text-white drop-shadow-md" />
            </motion.div>
            
            <motion.h1 
              className="text-4xl md:text-6xl font-extrabold text-white tracking-tight mb-2 drop-shadow-lg"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.8 }}
            >
              Q2 Connect
            </motion.h1>
            
            <motion.p 
              className="text-base md:text-lg text-zinc-200 font-medium tracking-wide uppercase drop-shadow-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.4, duration: 0.8 }}
            >
              Modern Hostel Management
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
