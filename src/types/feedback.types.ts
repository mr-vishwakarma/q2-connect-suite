import { HostelType, RequestStatus } from './common.types';

export interface Complaint {
  _id: string;
  id?: string;
  userId: string;
  studentId?: string;
  hostel: HostelType;
  title: string;
  description: string;
  category: 'maintenance' | 'food' | 'cleanliness' | 'wifi' | 'other';
  status: 'pending' | 'in_progress' | 'resolved';
  resolvedAt?: string | null;
  adminNotes?: string | null;
  createdAt: string;
  user?: {
    name: string;
    username: string;
    roomNo?: string;
  };
}

export interface Suggestion {
  _id: string;
  id?: string;
  userId: string;
  studentId?: string;
  hostel: HostelType;
  title: string;
  description: string;
  category: 'food' | 'facility' | 'activity' | 'other';
  status: 'pending' | 'reviewed' | 'implemented';
  adminNotes?: string | null;
  createdAt: string;
  user?: {
    name: string;
    username: string;
    roomNo?: string;
  };
}

export interface MealRating {
  _id?: string;
  userId: string;
  mealType: 'breakfast' | 'lunch' | 'dinner';
  date: string;
  rating: number;
  review?: string;
  hostel: HostelType;
}
