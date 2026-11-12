import { createContext } from 'react';

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

export interface HostelContextType {
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

export const HostelContext = createContext<HostelContextType | undefined>(undefined);

