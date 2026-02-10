import { motion, useInView } from 'framer-motion';
import { useRef, ReactNode } from 'react';

type AnimationDirection = 'left' | 'right' | 'up' | 'down' | 'fade' | 'scale';

interface AnimatedSectionProps {
  children: ReactNode;
  direction?: AnimationDirection;
  delay?: number;
  className?: string;
  duration?: number;
}

const getVariants = (direction: AnimationDirection) => {
  switch (direction) {
    case 'left':
      return {
        hidden: { opacity: 0, x: -40 },
        visible: { opacity: 1, x: 0 }
      };
    case 'right':
      return {
        hidden: { opacity: 0, x: 40 },
        visible: { opacity: 1, x: 0 }
      };
    case 'up':
      return {
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0 }
      };
    case 'down':
      return {
        hidden: { opacity: 0, y: -30 },
        visible: { opacity: 1, y: 0 }
      };
    case 'scale':
      return {
        hidden: { opacity: 0, scale: 0.92 },
        visible: { opacity: 1, scale: 1 }
      };
    case 'fade':
    default:
      return {
        hidden: { opacity: 0 },
        visible: { opacity: 1 }
      };
  }
};

export function AnimatedSection({ 
  children, 
  direction = 'up', 
  delay = 0, 
  className = '',
  duration = 0.3 
}: AnimatedSectionProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.1 });
  const variants = getVariants(direction);

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={variants}
      transition={{ 
        duration, 
        delay, 
        ease: [0.16, 1, 0.3, 1] 
      }}
      className={className}
      style={{ willChange: 'transform, opacity' }}
    >
      {children}
    </motion.div>
  );
}

// Card with 3D tilt effect
interface TiltCardProps {
  children: ReactNode;
  className?: string;
}

export function TiltCard({ children, className = '' }: TiltCardProps) {
  return (
    <motion.div
      className={className}
      whileHover={{ 
        scale: 1.02,
        rotateX: -5,
        rotateY: 5,
        transition: { duration: 0.3 }
      }}
      style={{ transformStyle: 'preserve-3d' }}
    >
      {children}
    </motion.div>
  );
}

// Staggered list container
interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

export function StaggerContainer({ children, className = '', staggerDelay = 0.05 }: StaggerContainerProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.1 });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: 0.03
          }
        }
      }}
      className={className}
      style={{ willChange: 'opacity' }}
    >
      {children}
    </motion.div>
  );
}

// Staggered item
interface StaggerItemProps {
  children: ReactNode;
  className?: string;
}

export function StaggerItem({ children, className = '' }: StaggerItemProps) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 15 },
        visible: { opacity: 1, y: 0 }
      }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={className}
      style={{ willChange: 'transform, opacity' }}
    >
      {children}
    </motion.div>
  );
}

// Floating element animation
interface FloatingElementProps {
  children: ReactNode;
  className?: string;
  duration?: number;
  y?: number;
}

export function FloatingElement({ children, className = '', duration = 4, y = 15 }: FloatingElementProps) {
  return (
    <motion.div
      animate={{ 
        y: [-y/2, y/2, -y/2],
      }}
      transition={{ 
        duration, 
        repeat: Infinity, 
        ease: 'easeInOut' 
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Glow button wrapper
interface GlowButtonProps {
  children: ReactNode;
  className?: string;
}

export function GlowButton({ children, className = '' }: GlowButtonProps) {
  return (
    <motion.div
      whileHover={{ 
        scale: 1.05,
        boxShadow: '0 0 30px hsl(var(--primary) / 0.5)'
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
