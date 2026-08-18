import { HostelType } from './common.types';

export interface Student {
  id: string;
  user_id: string;
  name: string;
  username: string;
  phone?: string | null;
  parent_phone?: string | null;
  email?: string | null;
  room_no: string | null;
  floor?: string | null;
  hostel?: HostelType | null;
  fees: number | null;
  start_date: string | null;
  valid_date: string | null;
  address?: string | null;
  dob?: string | null;
  profile_photo?: string | null;
  isActive?: boolean;
}

export interface StudentRegistrationPayload {
  name: string;
  username: string;
  email?: string;
  password?: string;
  phone?: string;
  parentPhone?: string;
  hostel: HostelType;
  roomNo?: string;
  floor?: string;
  fees: number;
  startDate: string;
  validDate: string;
  address?: string;
  dob?: string;
  profilePhoto?: string;
  profilePhotoFileId?: string;
  securityDeposit?: number;
  paymentMode?: 'cash' | 'upi' | 'bank';
  notes?: string;
}

export interface StudentAlert {
  id: string;
  name: string;
  username: string;
  phone?: string | null;
  parent_phone?: string | null;
  room_no: string | null;
  hostel?: string | null;
  fees: number | null;
  valid_date: string | null;
  days_remaining: number;
  is_expired: boolean;
  pending_amount: number;
}
