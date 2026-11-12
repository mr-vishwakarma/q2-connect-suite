import { api } from '@/lib/api';
import { ApiResponse, PaginationMeta, Student, StudentApiRecord, StudentRegistrationPayload } from '@/types';

export interface StudentListResponseData {
  students: StudentApiRecord[];
  pagination?: PaginationMeta;
  total?: number;
  totalPages?: number;
}

export interface AlertsCountResponse extends ApiResponse<{ count: number }> {
  count?: number;
}

export const studentService = {
  async getStudents(
    params?: { hostel?: string; search?: string; page?: number; limit?: number },
    options?: { signal?: AbortSignal }
  ): Promise<ApiResponse<StudentApiRecord[] | StudentListResponseData>> {
    const res = await api.get('/students', { params, signal: options?.signal });
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

  async getAlerts(params?: { hostel?: string }): Promise<ApiResponse<StudentApiRecord[]>> {
    const res = await api.get('/students/alerts', { params });
    return res.data;
  },

  async getAlertsCount(params?: { hostel?: string }): Promise<AlertsCountResponse> {
    const res = await api.get('/students/alerts/count', { params });
    return res.data;
  },
};
