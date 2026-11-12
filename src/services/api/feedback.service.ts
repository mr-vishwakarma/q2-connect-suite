import { api } from '@/lib/api';
import { ApiResponse, Complaint, MealRating, Suggestion } from '@/types';

export const feedbackService = {
  // Complaints
  async getComplaints(params?: { hostel?: string }): Promise<ApiResponse<Complaint[]>> {
    const res = await api.get('/complaints', { params });
    return res.data;
  },

  async createComplaint(payload: { title: string; description: string; category?: string; hostel?: string }): Promise<ApiResponse<Complaint>> {
    const res = await api.post('/complaints', payload);
    return res.data;
  },

  async updateComplaintStatus(
    id: string,
    payload: { status: string; adminReply?: string; adminNotes?: string }
  ): Promise<ApiResponse<Complaint>> {
    const res = await api.put(`/complaints/${id}`, {
      status: payload.status,
      ...(payload.adminReply !== undefined
        ? { adminReply: payload.adminReply }
        : payload.adminNotes !== undefined
          ? { adminReply: payload.adminNotes }
          : {}),
    });
    return res.data;
  },

  // Suggestions
  async getSuggestions(params?: { hostel?: string }): Promise<ApiResponse<Suggestion[]>> {
    const res = await api.get('/suggestions', { params });
    return res.data;
  },

  async createSuggestion(payload: { title: string; description: string; category?: string; hostel?: string }): Promise<ApiResponse<Suggestion>> {
    const res = await api.post('/suggestions', payload);
    return res.data;
  },

  async updateSuggestionStatus(
    id: string,
    payload: { status: string; adminReply?: string; adminNotes?: string }
  ): Promise<ApiResponse<Suggestion>> {
    const res = await api.put(`/suggestions/${id}`, {
      status: payload.status,
      ...(payload.adminReply !== undefined
        ? { adminReply: payload.adminReply }
        : payload.adminNotes !== undefined
          ? { adminReply: payload.adminNotes }
          : {}),
    });
    return res.data;
  },

  // Meal Ratings
  async getMealRatings(
    params?: { hostel?: string; startDate?: string; endDate?: string; date?: string }
  ): Promise<ApiResponse<{ ratings: MealRating[]; averageRating?: number; totalRatings?: number } | MealRating[]>> {
    const queryParams =
      params?.date && !params.startDate
        ? { ...params, startDate: params.date, endDate: params.date }
        : params;
    const res = await api.get('/rating/analytics', { params: queryParams });
    return res.data;
  },

  async submitMealRating(payload: {
    mealType: string;
    rating: number;
    feedback?: string;
    review?: string;
    hostel?: string;
  }): Promise<ApiResponse<MealRating>> {
    const res = await api.post('/rating/submit', {
      mealType: payload.mealType,
      rating: payload.rating,
      feedback: payload.feedback ?? payload.review,
    });
    return res.data;
  },
};
