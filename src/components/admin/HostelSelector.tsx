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

  const displayBranches: (HostelBranch | { _id: string; code: string; name: string; status: string })[] =
    branches.length > 0
      ? branches
      : [
          { _id: 'Q2', code: 'Q2', name: 'Q2 Gachibowli', status: 'ACTIVE' },
          { _id: 'Q2.0', code: 'Q2.0', name: 'Q2.0 Kondapur', status: 'ACTIVE' },
          { _id: 'Q2.1', code: 'Q2.1', name: 'Q2.1 Madhapur', status: 'ACTIVE' },
        ];

  if (displayBranches.length <= 4) {
    return (
      <div className="flex items-center gap-1 p-1 bg-[#151722]/90 rounded-xl border border-[rgba(225,225,255,0.08)]">
        {displayBranches.map((branch) => {
          const isSelected =
            selectedHostelId === branch._id ||
            (!selectedHostelId && currentBranch?.code === branch.code);

          const isSuspended = branch.status === 'SUSPENDED' || branch.status === 'INACTIVE';

          return (
            <button
              key={branch._id}
              type="button"
              onClick={() => setSelectedHostelId(branch._id)}
              className={cn(
                'relative px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg text-xs font-semibold transition-colors duration-200 flex items-center gap-1.5',
                isSelected ? 'text-[#F0EFF8]' : 'text-[#9295AD] hover:text-[#F0EFF8]',
                isSuspended && !isSelected && 'opacity-60',
              )}
              title={branch.name}
            >
              {isSelected && (
                <motion.div
                  layoutId="activeHostel"
                  className={cn(
                    'absolute inset-0 rounded-lg border',
                    isSuspended
                      ? 'bg-amber-500/20 border-amber-500/35'
                      : 'bg-gradient-to-r from-[#A78BFA]/25 to-[#7C5CE6]/25 border-[#A78BFA]/40 shadow-[0_0_14px_rgba(167,139,250,0.22)]',
                  )}
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.45 }}
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
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 px-3 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white/[0.04] hover:bg-white/[0.07] border border-[rgba(225,225,255,0.09)] text-[#F0EFF8] transition-all"
        >
          <Building2 className="w-4 h-4 text-[#A78BFA]" />
          <span className="truncate max-w-[110px] sm:max-w-[170px]">
            {currentBranch ? (currentBranch.name || currentBranch.code) : 'Select Branch'}
          </span>
          {currentBranch?.status === 'SUSPENDED' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">
              Paused
            </span>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-[#9295AD]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto">
        <DropdownMenuLabel>Hostel Branches</DropdownMenuLabel>
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
                'flex items-center justify-between py-2 px-3',
                isSelected && 'bg-[#A78BFA]/15 text-[#F0EFF8] font-semibold',
              )}
            >
              <div className="flex flex-col">
                <span className="font-medium text-[#F0EFF8]">{branch.name}</span>
                <span className="text-[11px] text-[#74788F]">Code: {branch.code}</span>
              </div>
              {isSuspended && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">
                  Paused
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
