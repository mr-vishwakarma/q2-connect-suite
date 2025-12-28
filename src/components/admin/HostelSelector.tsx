import { motion } from 'framer-motion';
import { useHostel } from '@/contexts/HostelContext';
import { cn } from '@/lib/utils';

const hostels = ['Q2', 'Q2.0', 'Q2.1'] as const;

export function HostelSelector() {
  const { selectedHostel, setSelectedHostel } = useHostel();

  return (
    <div className="flex items-center gap-2 p-1 bg-secondary/50 rounded-xl border border-border/50">
      {hostels.map((hostel) => (
        <motion.button
          key={hostel}
          onClick={() => setSelectedHostel(hostel)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            'relative px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300',
            selectedHostel === hostel
              ? 'text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {selectedHostel === hostel && (
            <motion.div
              layoutId="activeHostel"
              className="absolute inset-0 bg-primary rounded-lg shadow-lg"
              style={{ boxShadow: '0 0 20px hsl(217 91% 50% / 0.5)' }}
              transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
            />
          )}
          <span className="relative z-10">{hostel}</span>
        </motion.button>
      ))}
    </div>
  );
}
