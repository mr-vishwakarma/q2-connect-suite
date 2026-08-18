import { UserRole, HostelType } from './common.types';

export interface User {
  id: string;
  name: string;
  email: string;
  username?: string;
  role: UserRole;
  hostels?: HostelType[];
  profilePhoto?: string;
}

export interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  username: string | null;
  phone?: string | null;
  profilePhoto?: string;
  room_no?: string | null;
  hostel?: HostelType | null;
}

export interface AuthResponse {
  user: User;
  student?: any;
  accessToken: string;
  refreshToken: string;
}
