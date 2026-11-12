import { api } from '@/lib/api';
import { ApiResponse } from '@/types';

export interface AdminDashboardResponseData {
  stats?: {
    totalStudents: number;
    totalComplaints: number;
    totalSuggestions: number;
    studentsTrend?: string;
    complaintsTrend?: string;
    suggestionsTrend?: string;
  };
  complaintsSummary?: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  recentComplaints?: Array<{
    _id: string;
    title: string;
    description: string;
    createdAt: string;
    category?: string;
    tag?: string;
    isNew?: boolean;
    room_no?: string;
  }>;
  recentSuggestions?: Array<{
    _id: string;
    title: string;
    description: string;
    createdAt: string;
  }>;
  complaintsData?: Array<{
    name?: string;
    date?: string;
    count?: number;
    resolved?: number;
    pending?: number;
    [key: string]: unknown;
  }>;
  allocationDistribution?: {
    total: number;
    allocated: number;
    pending: number;
    vacant: number;
  };
  ratingSummary?: {
    averageRating: number;
    totalRatings: number;
  };
  [key: string]: unknown;
}

export interface StudentDashboardResponseData {
  student: {
    name: string;
    username: string;
    email?: string | null;
    phone?: string | null;
    parent_phone?: string | null;
    room_no: string | null;
    fees: number | null;
    start_date: string | null;
    valid_date: string | null;
    hostel: string | null;
    student_code?: string | null;
    profile_photo?: string | null;
  } | null;
  stats: {
    leaveRequests: number;
    complaints: number;
    suggestions: number;
    approvedRequests: number;
  };
}

export interface AdminAnalyticsResponseData {
  database: {
    totalUsers: number;
    totalStudents: number;
    totalRooms: number;
    totalComplaints: number;
    totalMessRequests: number;
  };
  sessions: {
    active: number;
  };
  system: Record<string, unknown>;
  api: {
    totalRequests: number;
    errors: number;
    byMethod: Record<string, number>;
  };
}

export const dashboardService = {
  async getAdminDashboard(params?: { hostel?: string }): Promise<ApiResponse<AdminDashboardResponseData>> {
    const res = await api.get('/dashboard/admin', { params });
    return res.data;
  },

  async getStudentDashboard(): Promise<ApiResponse<StudentDashboardResponseData>> {
    const res = await api.get('/dashboard/student');
    return res.data;
  },

  async getAnalytics(params?: { hostel?: string }): Promise<ApiResponse<AdminAnalyticsResponseData>> {
    const res = await api.get('/analytics', { params });
    return res.data;
  },
};
