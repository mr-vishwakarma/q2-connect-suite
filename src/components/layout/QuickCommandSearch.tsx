import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LucideIcon, Search } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

export interface SearchNavItem {
  to: string;
  label: string;
  group?: string;
  icon: LucideIcon;
}

interface QuickCommandSearchProps {
  items: SearchNavItem[];
  placeholder?: string;
}

export function QuickCommandSearch({ items, placeholder = 'Search...' }: QuickCommandSearchProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const grouped = items.reduce<Record<string, SearchNavItem[]>>((acc, item) => {
    const g = item.group || 'Navigation';
    if (!acc[g]) acc[g] = [];
    acc[g].push(item);
    return acc;
  }, {});

  return (
    <>
      {/* Desktop/Tablet Search Pill matching reference TopBar */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-between gap-2 h-9 sm:w-44 md:w-52 px-2.5 sm:px-3.5 rounded-xl bg-white/[0.035] hover:bg-white/[0.06] border border-[rgba(225,225,255,0.09)] hover:border-[rgba(210,195,255,0.20)] text-[#74788F] hover:text-[#9295AD] text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]/60 shrink-0"
        aria-label="Quick navigation search"
      >
        <span className="flex items-center gap-2 truncate">
          <Search className="w-3.5 h-3.5 shrink-0 text-[#9295AD]" />
          <span className="hidden sm:inline truncate">{placeholder}</span>
        </span>
        <kbd className="hidden md:inline-flex items-center gap-0.5 rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-medium text-[#74788F] border border-white/[0.07]">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Jump to any section or tool..." />
        <CommandList>
          <CommandEmpty>No matching pages found.</CommandEmpty>
          {Object.entries(grouped).map(([groupTitle, groupItems]) => (
            <CommandGroup key={groupTitle} heading={groupTitle}>
              {groupItems.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.to}
                    value={`${item.label} ${groupTitle}`}
                    onSelect={() => {
                      setOpen(false);
                      navigate(item.to);
                    }}
                  >
                    <Icon className="mr-2.5 h-4 w-4 text-[#A78BFA]" />
                    <span>{item.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}

