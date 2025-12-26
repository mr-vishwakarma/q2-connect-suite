import { motion } from 'framer-motion';
import hostelBuilding from '@/assets/hostel-building.jpg';

interface BuildingBackgroundProps {
  showOnHome?: boolean;
}

export function BuildingBackground({ showOnHome = false }: BuildingBackgroundProps) {
  if (!showOnHome) return null;
  
  return (
    <div className="fixed inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden">
      {/* Glass overlay */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      
      {/* Building image with parallax effect */}
      <motion.div 
        className="relative"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, ease: 'easeOut' }}
      >
        {/* Building container */}
        <div className="relative">
          {/* Glowing Q2 Hostel text - positioned above building */}
          <motion.div
            className="absolute -top-16 left-1/2 -translate-x-1/2 z-20"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            <motion.h2
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-transparent bg-clip-text whitespace-nowrap"
              style={{
                backgroundImage: 'linear-gradient(135deg, #ff3333 0%, #ff6666 50%, #ff3333 100%)',
                textShadow: '0 0 20px rgba(255, 51, 51, 0.8), 0 0 40px rgba(255, 51, 51, 0.6), 0 0 60px rgba(255, 51, 51, 0.4), 0 0 80px rgba(255, 51, 51, 0.3)',
                filter: 'drop-shadow(0 0 10px rgba(255, 51, 51, 0.9))'
              }}
              animate={{
                textShadow: [
                  '0 0 20px rgba(255, 51, 51, 0.8), 0 0 40px rgba(255, 51, 51, 0.6), 0 0 60px rgba(255, 51, 51, 0.4)',
                  '0 0 30px rgba(255, 51, 51, 1), 0 0 60px rgba(255, 51, 51, 0.8), 0 0 90px rgba(255, 51, 51, 0.5)',
                  '0 0 20px rgba(255, 51, 51, 0.8), 0 0 40px rgba(255, 51, 51, 0.6), 0 0 60px rgba(255, 51, 51, 0.4)',
                ]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            >
              Q2 Hostel
            </motion.h2>
          </motion.div>

          {/* Building image */}
          <motion.img
            src={hostelBuilding}
            alt="Q2 Hostel Building"
            className="max-h-[70vh] w-auto object-contain rounded-2xl opacity-60"
            style={{
              filter: 'brightness(0.7) contrast(1.1)',
              boxShadow: '0 0 100px rgba(37, 99, 235, 0.2)'
            }}
            whileHover={{ opacity: 0.7 }}
            transition={{ duration: 0.3 }}
          />
          
          {/* Gradient overlay on image */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/50 rounded-2xl" />
        </div>
      </motion.div>
    </div>
  );
}
