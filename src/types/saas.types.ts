export type OrganizationStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED';

export type HostelGenderType = 'GIRLS' | 'BOYS' | 'COED';

export type SaasRole =
  | 'SUPER_ADMIN'
  | 'ORGANIZATION_OWNER'
  | 'HOSTEL_ADMIN'
  | 'WARDEN'
  | 'ACCOUNTANT'
  | 'RECEPTIONIST'
  | 'STAFF'
  | 'STUDENT';

export type PlanTier = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE' | 'CUSTOM';

export type FeatureKey =
  | 'student_management'
  | 'room_management'
  | 'fee_management'
  | 'security_deposit'
  | 'attendance'
  | 'visitor_management'
  | 'complaints'
  | 'mess_management'
  | 'expense_management'
  | 'laundry'
  | 'reports'
  | 'advanced_analytics'
  | 'notifications'
  | 'custom_branding'
  | 'api_access'
  | 'biometric_integration';

export interface Organization {
  _id?: string;
  id: string;
  name: string;
  slug: string;
  logo?: string;
  legalName?: string;
  contactEmail: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  status: OrganizationStatus;
  subscriptionId?: string;
  activePlan?: string;
  hostelCount?: number;
  studentCount?: number;
  settings?: {
    currency?: string;
    timezone?: string;
    dateFormat?: string;
    allowMultiBranch?: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface HostelBranch {
  _id?: string;
  id: string;
  organizationId: string;
  name: string;
  code: string;
  address?: string;
  capacity?: number;
  occupiedCount?: number;
  genderType: HostelGenderType;
  contactPhone?: string;
  contactEmail?: string;
  wardenName?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  settings?: {
    lateFeePerDay?: number;
    gracePeriodDays?: number;
    laundrySlotsPerDay?: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface Membership {
  _id?: string;
  id: string;
  userId: string;
  organizationId: string;
  role: SaasRole;
  hostelAccess: string[]; // ['all'] or array of hostelIds
  permissions?: string[];
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED';
  joinedAt?: string;
  user?: {
    name: string;
    email: string;
    username?: string;
    profilePhoto?: string;
  };
}

export interface PlanLimits {
  maxStudents: number;
  maxRooms: number;
  maxHostels: number;
  maxStaff: number;
  storageGb?: number;
}

export interface SubscriptionPlan {
  _id?: string;
  id: string;
  name: string;
  code: PlanTier;
  description?: string;
  priceMonthly: number;
  priceYearly: number;
  limits: PlanLimits;
  includedFeatures: FeatureKey[];
  isActive: boolean;
  isPopular?: boolean;
}

export interface TenantSubscription {
  _id?: string;
  id: string;
  organizationId: string;
  planId: string;
  plan?: SubscriptionPlan;
  status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
  billingCycle: 'MONTHLY' | 'YEARLY';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt?: string;
  usage: {
    studentCount: number;
    roomCount: number;
    hostelCount: number;
    staffCount: number;
  };
}

export interface FeatureDefinition {
  key: FeatureKey;
  name: string;
  description: string;
  category: 'core' | 'operations' | 'finance' | 'advanced';
  defaultEnabled: boolean;
}

export interface OrganizationFeature {
  organizationId: string;
  featureKey: FeatureKey;
  enabled: boolean;
  configuration?: Record<string, any>;
  limits?: Record<string, number>;
}

export interface AuditLogItem {
  _id: string;
  id?: string;
  organizationId?: string;
  hostelId?: string;
  actorId: string;
  actorName?: string;
  actorEmail?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

export interface ImpersonationSession {
  _id: string;
  superAdminId: string;
  targetUserId: string;
  organizationId: string;
  targetUserName?: string;
  organizationName?: string;
  reason: string;
  startedAt: string;
  endedAt?: string;
  isActive: boolean;
}

export interface Expense {
  _id: string;
  id?: string;
  organizationId: string;
  hostelId: string;
  category: 'ELECTRICITY' | 'WATER' | 'FOOD' | 'MAINTENANCE' | 'SALARY' | 'INTERNET' | 'CLEANING' | 'OTHER';
  amount: number;
  date: string;
  vendor?: string;
  description: string;
  receiptUrl?: string;
  paymentMode: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CARD';
  status: 'PAID' | 'PENDING';
  createdBy: string;
  createdAt: string;
}

export interface SuperAdminDashboardStats {
  totalOrganizations: number;
  activeOrganizations: number;
  trialOrganizations: number;
  suspendedOrganizations: number;
  totalHostels: number;
  totalStudents: number;
  totalRooms: number;
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
  platformCollectionRate: number;
  recentActivity: Array<{
    id: string;
    action: string;
    description: string;
    timestamp: string;
    type: 'org' | 'subscription' | 'feature' | 'security';
  }>;
  growthMetrics: {
    months: string[];
    organizations: number[];
    students: number[];
    revenue: number[];
  };
}
