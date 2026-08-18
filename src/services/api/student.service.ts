import { api } from '@/lib/api';
import { ApiResponse, Student, StudentAlert, StudentRegistrationPayload } from '@/types';

export const studentService = {
  async getStudents(params?: { hostel?: string; search?: string; page?: number; limit?: number }): Promise<ApiResponse<any>> {
    const res = await api.get('/students', { params });
    return res.data;
  },

  async getStudentById(id: string): Promise<ApiResponse<Student>> {
    const res = await api.get(`/students/${id}`);
    return res.data;
  },

  async createStudent(payload: StudentRegistrationPayload): Promise<ApiResponse<Student>> {
    const res = await api.post('/students', payload);
    return res.data;
  },

  async updateStudent(id: string, payload: Partial<StudentRegistrationPayload>): Promise<ApiResponse<Student>> {
    const res = await api.put(`/students/${id}`, payload);
    return res.data;
  },

  async deleteStudent(id: string): Promise<ApiResponse<void>> {
    const res = await api.delete(`/students/${id}`);
    return res.data;
  },

  async getAlerts(params?: { hostel?: string }): Promise<ApiResponse<{ count: number; students: StudentAlert[] }>> {
    const res = await api.get('/students/alerts', { params });
    return res.data;
  },

  async getAlertsCount(params?: { hostel?: string }): Promise<ApiResponse<{ count: number }>> {
    const res = await api.get('/students/alerts/count', { params });
    return res.data;
  },
};
