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

  async updateComplaintStatus(id: string, payload: { status: string; adminNotes?: string }): Promise<ApiResponse<Complaint>> {
    const res = await api.put(`/complaints/${id}/status`, payload);
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

  async updateSuggestionStatus(id: string, payload: { status: string; adminNotes?: string }): Promise<ApiResponse<Suggestion>> {
    const res = await api.put(`/suggestions/${id}/status`, payload);
    return res.data;
  },

  // Meal Ratings
  async getMealRatings(params?: { hostel?: string; date?: string }): Promise<ApiResponse<any>> {
    const res = await api.get('/rating', { params });
    return res.data;
  },

  async submitMealRating(payload: { mealType: string; rating: number; review?: string; hostel?: string }): Promise<ApiResponse<MealRating>> {
    const res = await api.post('/rating', payload);
    return res.data;
  },
};
