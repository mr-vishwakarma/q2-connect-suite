export type StudentStatus = 'paid' | 'pending' | 'overdue' | 'upcoming';

export interface ResidentAvatar {
  id: string;
  name: string;
  room: string;
  floor: string;
  feeAmount: number;
  status: StudentStatus;
  avatarUrl?: string;
  deposit: number;
  roommates: string[];
  course?: string;
  phone?: string;
  joinDate?: string;
}

export interface RoomBedInfo {
  roomNo: string;
  floor: string;
  totalBeds: number;
  occupiedBeds: number;
  occupants: string[];
  type: 'Triple Sharing' | 'Double Sharing' | 'Single Premium';
  rentPerBed: number;
  monthlyRevenue: number;
  amenities: string[];
}

export interface PricingPlan {
  id: string;
  name: string;
  tagline: string;
  priceMonthly: number;
  priceYearly: number;
  popular?: boolean;
  features: string[];
  ctaText: string;
}

export interface FAQItem {
  question: string;
  answer: string;
  category: 'General' | 'Operations' | 'Billing' | 'Security';
}

export interface Testimonial {
  quote: string;
  author: string;
  role: string;
  hostelName: string;
  location: string;
  metrics: string;
}
