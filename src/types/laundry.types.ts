import { HostelType } from './common.types';

export interface LaundrySlot {
  _id: string;
  id?: string;
  userId: string;
  studentId?: string;
  hostel: HostelType;
  date: string;
  timeSlot: string;
  status: 'booked' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: string;
  student?: {
    name: string;
    username: string;
    roomNo?: string;
    phone?: string;
  };
}
