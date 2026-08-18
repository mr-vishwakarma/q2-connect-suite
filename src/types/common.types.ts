export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T = any> {
  success: boolean;
  data: {
    items?: T[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
    [key: string]: any;
  };
}

export type HostelType = 'Q2' | 'Q2.0' | 'Q2.1' | 'All';

export type UserRole = 'admin' | 'student' | 'warden';

export type PaymentMode = 'cash' | 'upi' | 'bank';

export type FeeStatus = 'paid' | 'unpaid' | 'partial' | 'pending' | 'overdue' | 'upcoming';

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'in_progress' | 'resolved';
