export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T = unknown> {
  success: boolean;
  data: {
    items?: T[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
    [key: string]: unknown;
  };
}

export type HostelType = string;

export type UserRole = 'admin' | 'student' | 'warden';

export type PaymentMode = 'cash' | 'upi' | 'bank';

export type FeeStatus = 'paid' | 'unpaid' | 'partial' | 'pending' | 'overdue' | 'upcoming';

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'in_progress' | 'resolved';
