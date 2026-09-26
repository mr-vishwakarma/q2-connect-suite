import { motion } from 'framer-motion';
import { useHostel, HostelBranch } from '@/contexts/HostelContext';
import { cn } from '@/lib/utils';
import { Building2, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function HostelSelector() {
  const { selectedHostelId, currentBranch, branches, setSelectedHostelId } = useHostel();

  // If no dynamic branches loaded yet, render fallback
  const displayBranches: (HostelBranch | { _id: string; code: string; name: string; status: string })[] =
    branches.length > 0
      ? branches
      : [
          { _id: 'Q2', code: 'Q2', name: 'Q2 Gachibowli', status: 'ACTIVE' },
          { _id: 'Q2.0', code: 'Q2.0', name: 'Q2.0 Kondapur', status: 'ACTIVE' },
          { _id: 'Q2.1', code: 'Q2.1', name: 'Q2.1 Madhapur', status: 'ACTIVE' },
        ];

  // For compact view or when <= 3 branches, show toggle pills
  if (displayBranches.length <= 4) {
    return (
      <div className="flex items-center gap-1 p-0.5 sm:p-1 bg-secondary/50 rounded-lg sm:rounded-xl border border-border/50">
        {displayBranches.map((branch) => {
          const isSelected =
            selectedHostelId === branch._id ||
            (!selectedHostelId && currentBranch?.code === branch.code);

          const isSuspended = branch.status === 'SUSPENDED' || branch.status === 'INACTIVE';

          return (
            <motion.button
              key={branch._id}
              onClick={() => setSelectedHostelId(branch._id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'relative px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-xs sm:text-sm font-bold transition-all duration-300 flex items-center gap-1.5',
                isSelected
                  ? 'text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
                isSuspended && !isSelected && 'opacity-60'
              )}
              title={branch.name}
            >
              {isSelected && (
                <motion.div
                  layoutId="activeHostel"
                  className={cn(
                    'absolute inset-0 rounded-md sm:rounded-lg shadow-lg',
                    isSuspended ? 'bg-amber-600' : 'bg-primary'
                  )}
                  style={{
                    boxShadow: isSuspended
                      ? '0 0 20px rgba(217, 119, 6, 0.4)'
                      : '0 0 20px hsl(0 100% 50% / 0.4)',
                  }}
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1">
                {branch.code || branch.name}
                {isSuspended && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 uppercase font-semibold">
                    Paused
                  </span>
                )}
              </span>
            </motion.button>
          );
        })}
      </div>
    );
  }

  // For organizations with more than 4 branches, use an interactive dropdown selector
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold bg-secondary/60 hover:bg-secondary/90 border border-border/60 transition-all shadow-sm'
          )}
        >
          <Building2 className="w-4 h-4 text-primary" />
          <span className="truncate max-w-[130px] sm:max-w-[180px]">
            {currentBranch ? (currentBranch.name || currentBranch.code) : 'Select Branch'}
          </span>
          {currentBranch?.status === 'SUSPENDED' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">
              Suspended
            </span>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-1" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto">
        <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
          Hostel Branches
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {displayBranches.map((branch) => {
          const isSelected =
            selectedHostelId === branch._id ||
            (!selectedHostelId && currentBranch?.code === branch.code);
          const isSuspended = branch.status === 'SUSPENDED' || branch.status === 'INACTIVE';

          return (
            <DropdownMenuItem
              key={branch._id}
              onClick={() => setSelectedHostelId(branch._id)}
              className={cn(
                'flex items-center justify-between cursor-pointer py-2 px-3 rounded-md text-xs sm:text-sm',
                isSelected && 'bg-primary/10 text-primary font-bold'
              )}
            >
              <div className="flex flex-col">
                <span className="font-medium text-foreground">{branch.name}</span>
                <span className="text-[11px] text-muted-foreground">Code: {branch.code}</span>
              </div>
              {isSuspended && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-semibold">
                  Suspended
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
