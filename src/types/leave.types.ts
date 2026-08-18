import { HostelType, RequestStatus } from './common.types';

export interface LeaveRequest {
  _id: string;
  id?: string;
  userId: string;
  studentId?: string;
  hostel: HostelType;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  createdAt: string;
  user?: {
    name: string;
    username: string;
    roomNo?: string;
    parentPhone?: string;
  };
}
