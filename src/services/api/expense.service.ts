import { api } from '@/lib/api';
import { ApiResponse, Expense } from '@/types';

export interface ExpenseListResponse extends ApiResponse<Expense[]> {
  total?: number;
  totalPages?: number;
}

export interface CreateExpensePayload {
  category: string;
  amount: number;
  vendor?: string;
  description: string;
  paymentMode: string;
  hostelId?: string;
  date?: string;
}

export const expenseService = {
  async getExpenses(params?: {
    hostel?: string;
    category?: string;
    month?: string;
    page?: number;
    limit?: number;
  }): Promise<ExpenseListResponse> {
    const res = await api.get('/expenses', { params });
    return res.data;
  },

  async createExpense(payload: CreateExpensePayload): Promise<ApiResponse<Expense>> {
    const res = await api.post('/expenses', payload);
    return res.data;
  },

  async deleteExpense(id: string): Promise<ApiResponse<void>> {
    const res = await api.delete(`/expenses/${id}`);
    return res.data;
  },
};
