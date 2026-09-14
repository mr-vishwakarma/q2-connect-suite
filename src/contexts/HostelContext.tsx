import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

type HostelType = 'Q2' | 'Q2.0' | 'Q2.1';

interface HostelContextType {
  selectedHostel: HostelType;
  setSelectedHostel: (hostel: HostelType) => void;
}

const HostelContext = createContext<HostelContextType | undefined>(undefined);

export function HostelProvider({ children }: { children: ReactNode }) {
  const [selectedHostel, setSelectedHostelState] = useState<HostelType>(() => {
    const stored = sessionStorage.getItem('selectedHostel');
    if (stored === 'Q2' || stored === 'Q2.0' || stored === 'Q2.1') return stored;
    return 'Q2';
  });

  const setSelectedHostel = useCallback((hostel: HostelType) => {
    setSelectedHostelState(hostel);
    sessionStorage.setItem('selectedHostel', hostel);
  }, []);

  const value = useMemo(
    () => ({ selectedHostel, setSelectedHostel }),
    [selectedHostel, setSelectedHostel]
  );

  return (
    <HostelContext.Provider value={value}>
      {children}
    </HostelContext.Provider>
  );
}

export function useHostel() {
  const context = useContext(HostelContext);
  if (context === undefined) {
    throw new Error('useHostel must be used within a HostelProvider');
  }
  return context;
}
