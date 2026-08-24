import { api } from '@/lib/api';
import { ApiResponse, Expense } from '@/types';

export const expenseService = {
  async getExpenses(params?: { hostel?: string; category?: string; month?: string }): Promise<ApiResponse<Expense[]>> {
    const res = await api.get('/expenses', { params });
    return res.data;
  },

  async createExpense(payload: Partial<Expense>): Promise<ApiResponse<Expense>> {
    const res = await api.post('/expenses', payload);
    return res.data;
  },

  async deleteExpense(id: string): Promise<ApiResponse<void>> {
    const res = await api.delete(`/expenses/${id}`);
    return res.data;
  },
};
