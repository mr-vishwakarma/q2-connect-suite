import { useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandling';
import { HostelBranch, HostelContext } from './hostelContextInstance';

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
    const saved = sessionStorage.getItem('selectedHostel');
    if (saved) return saved;
    try {
      const cached = localStorage.getItem('cached_hostel_branches');
      const parsed: HostelBranch[] = cached ? JSON.parse(cached) : [];
      const savedId = sessionStorage.getItem('selectedHostelId') || localStorage.getItem('selectedHostelId');
      const matched = parsed.find((b) => b._id === savedId) || parsed.find((b) => b.status === 'ACTIVE') || parsed[0];
      return matched?.code || '';
    } catch {
      return '';
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('accessToken') && !sessionStorage.getItem('selectedHostel'));
  });
  const [error, setError] = useState<string | null>(null);

  // Fetch branches dynamically from API
  const fetchBranches = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setIsLoading(false);
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
        } else {
          // Safe fallback if organization has no explicit branches returned
          setSelectedHostelIdState(null);
          const fallbackCode = storedCode || 'MAIN';
          setSelectedHostelCode(fallbackCode);
        }
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Failed to fetch hostel branches');
      console.warn('Could not fetch hostel branches from backend:', msg);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load on mount and when auth token changes
  useEffect(() => {
    fetchBranches();

    const handleAuthChange = () => fetchBranches();
    const handleAuthLogout = () => {
      setBranches([]);
      setSelectedHostelIdState(null);
      setSelectedHostelCode('');
      setError(null);
      setIsLoading(false);
    };

    window.addEventListener('storage', handleAuthChange);
    window.addEventListener('auth:login_success', handleAuthChange);
    window.addEventListener('auth:logout', handleAuthLogout);
    window.addEventListener('auth:unauthorized', handleAuthLogout);

    return () => {
      window.removeEventListener('storage', handleAuthChange);
      window.removeEventListener('auth:login_success', handleAuthChange);
      window.removeEventListener('auth:logout', handleAuthLogout);
      window.removeEventListener('auth:unauthorized', handleAuthLogout);
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
      if (!selectedHostelCode) return null;
      return branches.find((b) => b.code.toUpperCase() === selectedHostelCode.toUpperCase()) || null;
    }
    return branches.find((b) => b._id === selectedHostelId) || null;
  }, [branches, selectedHostelId, selectedHostelCode]);

  const value = useMemo(
    () => ({
      selectedHostelId,
      selectedHostel: currentBranch?.code || selectedHostelCode || '',
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

