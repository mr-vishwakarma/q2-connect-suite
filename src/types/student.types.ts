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
  security_deposit?: number | null;
  start_date: string | null;
  valid_date: string | null;
  address?: string | null;
  dob?: string | null;
  profile_photo?: string | null;
  student_code?: string | null;
  studentCode?: string | null;
  isActive?: boolean;
}

export interface StudentApiRecord {
  _id: string;
  id?: string;
  userId?: string | { _id: string; name?: string; email?: string; username?: string } | null;
  name: string;
  username: string;
  email?: string | null;
  phone?: string | null;
  parentPhone?: string | null;
  roomNo?: string | null;
  floor?: string | null;
  hostel?: HostelType | null;
  fees?: number | null;
  securityDeposit?: number | null;
  startDate?: string | null;
  validDate?: string | null;
  address?: string | null;
  dob?: string | null;
  profilePhoto?: string | null;
  studentCode?: string | null;
  isActive?: boolean;
  registrationStatus?: string;
  createdAt?: string;
  updatedAt?: string;
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
  studentCode?: string;
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
