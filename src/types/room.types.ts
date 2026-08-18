import { HostelType } from './common.types';

export interface Room {
  id?: string;
  _id?: string;
  roomNumber: string;
  hostel: HostelType;
  capacity: number;
  occupiedCount: number;
  status: 'available' | 'full';
  students?: Array<{
    _id: string;
    name: string;
    username: string;
    phone?: string;
    validDate?: string;
    profilePhoto?: string;
  }>;
}
