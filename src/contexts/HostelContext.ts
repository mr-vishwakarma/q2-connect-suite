import { useContext } from 'react';
import { HostelContext } from './hostelContextInstance';

export type { HostelBranch, HostelType, HostelContextType } from './hostelContextInstance';

export function useHostel() {
  const context = useContext(HostelContext);
  if (context === undefined) {
    throw new Error('useHostel must be used within a HostelProvider');
  }
  return context;
}

