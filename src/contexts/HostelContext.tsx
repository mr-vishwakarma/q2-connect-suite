import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { api } from '@/lib/api';

export interface HostelBranch {
  _id: string;
  organizationId?: string | { _id: string; name: string; slug: string };
  code: string;
  name: string;
  slug?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  genderType?: 'BOYS' | 'GIRLS' | 'COED';
  capacity?: number;
  totalRooms?: number;
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | 'ARCHIVED';
  wardenName?: string;
  wardenPhone?: string;
  contactPhone?: string;
  contactEmail?: string;
  metrics?: {
    capacity: number;
    occupied: number;
    vacant: number;
    roomCount: number;
    studentCount: number;
    occupancyRate: number;
  };
}

export type HostelType = string;

interface HostelContextType {
  selectedHostelId: string | null;
  selectedHostel: string;
  currentBranch: HostelBranch | null;
  branches: HostelBranch[];
  isLoading: boolean;
  error: string | null;
  refetchBranches: () => Promise<void>;
  setSelectedHostelId: (id: string) => void;
  setSelectedHostel: (hostelIdentifier: string) => void;
}

const HostelContext = createContext<HostelContextType | undefined>(undefined);

export function HostelProvider({ children }: { children: ReactNode }) {
  const [branches, setBranches] = useState<HostelBranch[]>(() => {
    try {
      const cached = localStorage.getItem('cached_hostel_branches');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [selectedHostelId, setSelectedHostelIdState] = useState<string | null>(() => {
    return sessionStorage.getItem('selectedHostelId') || localStorage.getItem('selectedHostelId') || null;
  });

  const [selectedHostelCode, setSelectedHostelCode] = useState<string>(() => {
    return sessionStorage.getItem('selectedHostel') || 'Q2';
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch branches dynamically from API
  const fetchBranches = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const res = await api.get('/hostels');
      if (res.data?.success && Array.isArray(res.data.data)) {
        const fetchedBranches: HostelBranch[] = res.data.data;
        setBranches(fetchedBranches);
        localStorage.setItem('cached_hostel_branches', JSON.stringify(fetchedBranches));

        // Reconcile selected hostel
        const storedId = sessionStorage.getItem('selectedHostelId') || localStorage.getItem('selectedHostelId');
        const storedCode = sessionStorage.getItem('selectedHostel');

        let matched = fetchedBranches.find((b) => b._id === storedId);
        if (!matched && storedCode) {
          matched = fetchedBranches.find(
            (b) => b.code.toUpperCase() === storedCode.toUpperCase() || b.name.toLowerCase() === storedCode.toLowerCase()
          );
        }

        // Fallback to first active branch or first available branch
        if (!matched && fetchedBranches.length > 0) {
          matched = fetchedBranches.find((b) => b.status === 'ACTIVE') || fetchedBranches[0];
        }

        if (matched) {
          setSelectedHostelIdState(matched._id);
          setSelectedHostelCode(matched.code || matched.name);
          sessionStorage.setItem('selectedHostelId', matched._id);
          sessionStorage.setItem('selectedHostel', matched.code || matched.name);
          localStorage.setItem('selectedHostelId', matched._id);
        }
      }
    } catch (err: any) {
      console.warn('Could not fetch hostel branches from backend:', err.message);
      setError(err.response?.data?.message || err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load on mount and when auth token changes
  useEffect(() => {
    fetchBranches();

    // Re-fetch on login / auth change events
    const handleAuthChange = () => fetchBranches();
    window.addEventListener('storage', handleAuthChange);
    window.addEventListener('auth:login_success', handleAuthChange);

    return () => {
      window.removeEventListener('storage', handleAuthChange);
      window.removeEventListener('auth:login_success', handleAuthChange);
    };
  }, [fetchBranches]);

  // Set by canonical branch ID
  const setSelectedHostelId = useCallback((id: string) => {
    setSelectedHostelIdState(id);
    sessionStorage.setItem('selectedHostelId', id);
    localStorage.setItem('selectedHostelId', id);

    const branch = branches.find((b) => b._id === id);
    if (branch) {
      const code = branch.code || branch.name;
      setSelectedHostelCode(code);
      sessionStorage.setItem('selectedHostel', code);
    }
  }, [branches]);

  // Set by code / name or ID (backward-compatible)
  const setSelectedHostel = useCallback((identifier: string) => {
    const clean = identifier.trim();
    // Try matching by ID first
    let branch = branches.find((b) => b._id === clean);
    if (!branch) {
      // Try matching by code (e.g. 'Q2', 'Q2.0', 'Q2.1')
      branch = branches.find((b) => b.code.toUpperCase() === clean.toUpperCase());
    }
    if (!branch) {
      // Try matching by name
      branch = branches.find((b) => b.name.toLowerCase() === clean.toLowerCase());
    }

    if (branch) {
      setSelectedHostelId(branch._id);
    } else {
      // Fallback for temporary local state
      setSelectedHostelCode(clean);
      sessionStorage.setItem('selectedHostel', clean);
    }
  }, [branches, setSelectedHostelId]);

  // Compute active branch object
  const currentBranch = useMemo(() => {
    if (!selectedHostelId) {
      return branches.find((b) => b.code.toUpperCase() === selectedHostelCode.toUpperCase()) || null;
    }
    return branches.find((b) => b._id === selectedHostelId) || null;
  }, [branches, selectedHostelId, selectedHostelCode]);

  const value = useMemo(
    () => ({
      selectedHostelId,
      selectedHostel: currentBranch?.code || selectedHostelCode || 'Q2',
      currentBranch,
      branches,
      isLoading,
      error,
      refetchBranches: fetchBranches,
      setSelectedHostelId,
      setSelectedHostel,
    }),
    [selectedHostelId, selectedHostelCode, currentBranch, branches, isLoading, error, fetchBranches, setSelectedHostelId, setSelectedHostel]
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
