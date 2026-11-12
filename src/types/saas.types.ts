export type OrganizationStatus =
  | 'PENDING_PAYMENT'
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAYMENT_FAILED'
  | 'EXPIRED'
  | 'PAST_DUE'
  | 'SUSPENDED'
  | 'CANCELLED';

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

export type PlanTier = 'STARTER' | 'GROWTH' | 'PROFESSIONAL' | 'ENTERPRISE' | 'CUSTOM' | (string & {});

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

export enum HostelAmenity {
  WIFI = 'High-Speed Wi-Fi',
  AC = 'Air Conditioning',
  POWER_BACKUP = '24x7 Power Backup',
  RO_WATER = 'RO Purified Drinking Water',
  CCTV = 'CCTV Surveillance',
  BIOMETRIC_ACCESS = 'Biometric Gate Access',
  GYM = 'Fitness Center / Gym',
  STUDY_LIBRARY = 'Quiet Study Room / Library',
  LAUNDRY = 'Washing Machine / Laundry',
  HOT_WATER = 'Geyser / Solar Hot Water',
  REFRIGERATOR = 'Common Refrigerator',
  HOUSEKEEPING = 'Daily Housekeeping',
}

export interface OnboardTenantPayload {
  // Stage 1: Organization & KYC
  name: string;
  legalName?: string;
  slug?: string;
  contactEmail: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  aadhaarNumber?: string;
  aadhaarDocument?: string;
  gstin?: string;
  pan?: string;
  orgType?: string;
  primaryColor?: string;

  // Stage 2: Property & Amenities
  branchName?: string;
  branchCode?: string;
  genderType?: HostelGenderType;
  propertyAddress?: string;
  capacity?: number;
  floors?: number;
  totalRooms?: number;
  amenities?: string[];
  wardenName?: string;
  wardenPhone?: string;
  emergencyContact?: string;

  // Stage 3: Primary Administrator Account
  adminName?: string;
  adminEmail?: string;
  adminUsername?: string;
  adminPhone?: string;
  adminPassword?: string;
  adminDesignation?: string;

  // Stage 4: Subscription & Policies
  planCode?: string;
  planId?: string;
  billingCycle?: 'MONTHLY' | 'YEARLY';
  activationMode?: 'PENDING_PAYMENT' | 'FREE_TRIAL';
  trialDays?: number;

  monthlyRentDueDay?: number;
  gracePeriodDays?: number;
  lateFeePerDay?: number;
  securityDeposit?: number;
  hasMess?: boolean;
  messOffNoticeHours?: number;
  messRebatePerDay?: number;
  laundrySlotsPerWeek?: number;
  curfewTime?: string;
  parentConsentRequired?: boolean;
}

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
  pincode?: string;
  country?: string;
  aadhaarNumber?: string;
  aadhaarDocument?: string;
  gstin?: string;
  pan?: string;
  orgType?: string;
  primaryColor?: string;
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
  currency?: string;
  allowedBillingCycles?: ('MONTHLY' | 'YEARLY')[];
  trialEligible?: boolean;
  trialDays?: number;
  sortOrder?: number;
  version?: number;
  status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  limits: PlanLimits;
  includedFeatures: FeatureKey[];
  isActive: boolean;
  isPopular?: boolean;
  badgeText?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PricingSnapshot {
  planId?: string;
  planCode?: string;
  planName?: string;
  planDescription?: string;
  planVersion?: number;
  billingCycle?: 'MONTHLY' | 'YEARLY';
  agreedPriceRupees?: number;
  finalPayableRupees?: number;
  monthlyPriceAtPurchase?: number;
  yearlyPriceAtPurchase?: number;
  currency?: string;
  trialEligible?: boolean;
  trialDays?: number;
  limits?: PlanLimits;
  includedFeatures?: string[];
  capturedAt?: string;
  source?: string;
}

export interface ScheduledPlanChange {
  targetPlanId?: string;
  targetPlanCode?: string;
  targetPlanName?: string;
  targetBillingCycle?: 'MONTHLY' | 'YEARLY';
  targetPriceRupees?: number;
  changeType?: 'DOWNGRADE' | 'PLAN_SWITCH';
  effectiveDate?: string;
  scheduledAt?: string;
  capacityWarnings?: string[];
  acknowledgedCapacityWarning?: boolean;
  status?: 'NONE' | 'SCHEDULED' | 'APPLIED' | 'CANCELLED';
}

export interface SubscriptionHistoryItem {
  _id?: string;
  eventType: string;
  fromStatus?: string;
  toStatus?: string;
  fromPlanId?: string;
  fromPlanName?: string;
  toPlanId?: string;
  toPlanName?: string;
  billingCycle?: 'MONTHLY' | 'YEARLY';
  amountRupees?: number;
  activationMethod?: string;
  paymentId?: string;
  invoiceNumber?: string;
  voucherReference?: string;
  actorName?: string;
  actorEmail?: string;
  notes?: string;
  createdAt?: string;
}

export interface SubscriptionAvailableActions {
  isTrial?: boolean;
  isPaidActive?: boolean;
  isPendingPayment?: boolean;
  isExpired?: boolean;
  canActivatePlan?: boolean;
  canApplyVoucher?: boolean;
  canRenew?: boolean;
  canReactivate?: boolean;
  canUpgrade?: boolean;
  canDowngrade?: boolean;
  canStartTrial?: boolean;
}

export interface TenantSubscription {
  _id?: string;
  id: string;
  organizationId: string;
  planId: string;
  plan?: SubscriptionPlan;
  status:
    | 'CREATED'
    | 'PENDING_PAYMENT'
    | 'PAYMENT_FAILED'
    | 'TRIAL'
    | 'ACTIVE'
    | 'PAST_DUE'
    | 'EXPIRED'
    | 'CANCELLED'
    | 'SUSPENDED';
  activationMethod?: 'PENDING' | 'ONLINE_PAYMENT' | 'VOUCHER' | 'FREE_TRIAL' | 'MANUAL_OVERRIDE';
  billingCycle: 'MONTHLY' | 'YEARLY';
  agreedPriceRupees?: number;
  pricingSnapshot?: PricingSnapshot;
  scheduledPlanChange?: ScheduledPlanChange;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  startedAt?: string;
  activatedAt?: string;
  trialStartsAt?: string;
  trialEndsAt?: string;
  trialUsed?: boolean;
  lastVoucherReference?: string;
  availableActions?: SubscriptionAvailableActions;
  history?: SubscriptionHistoryItem[];
  usage: {
    studentCount: number;
    roomCount: number;
    hostelCount: number;
    staffCount: number;
  };
}

export interface FeatureDefinition {
  _id?: string;
  id?: string;
  key: string;
  name: string;
  description: string;
  category: 'core' | 'operations' | 'finance' | 'advanced';
  defaultEnabled: boolean;
}

export interface OrganizationFeature {
  organizationId: string;
  featureKey: FeatureKey;
  enabled: boolean;
  configuration?: Record<string, unknown>;
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
  oldValue?: unknown;
  newValue?: unknown;
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

export interface SaasUserListItem {
  _id: string;
  name: string;
  email: string;
  username?: string;
  role: string;
  isActive: boolean;
  isLocked: boolean;
  failedLoginAttempts?: number;
  lockUntil?: string;
  createdAt: string;
  lastLogin?: string;
  organization?: {
    _id: string;
    name: string;
    slug?: string;
    status?: string;
  };
  membership?: {
    role: string;
    status: string;
    joinedAt: string;
  };
}

export interface DetailedAnalytics {
  overview: {
    totalOrgs: number;
    activeOrgs: number;
    trialOrgs: number;
    suspendedOrgs: number;
    cancelledOrgs: number;
    totalHostels: number;
    totalStudents: number;
    totalCapacity: number;
    totalOccupied: number;
    occupancyRate: number;
    mrr: number;
    arr: number;
    arpu: number;
    activeSubCount: number;
    trialSubCount: number;
    pastDueSubCount: number;
  };
  planDistribution: Array<{
    name: string;
    count: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    organizations: number;
    students: number;
    mrr: number;
  }>;
}

export interface SecurityOverview {
  metrics: {
    lockedAccountsCount: number;
    highRiskUsersCount: number;
    activeSuperAdminsCount: number;
    recentCriticalEventsCount: number;
  };
  lockedUsers: Array<{
    _id: string;
    name: string;
    email: string;
    role: string;
    failedLoginAttempts: number;
    lockUntil: string;
    updatedAt: string;
  }>;
  securityEvents: Array<{
    _id: string;
    action: string;
    description?: string;
    actorName: string;
    actorRole?: string;
    result?: 'SUCCESS' | 'FAILURE' | 'DENIED' | string;
    entityType: string;
    entityId: string;
    ipAddress?: string;
    userAgent?: string;
    createdAt: string;
  }>;
}

export interface SystemHealthData {
  timestamp: string | Date;
  status: 'OPERATIONAL' | 'HEALTHY' | 'DEGRADED' | 'DOWN';
  environment: string | {
    nodeVersion?: string;
    platform?: string;
    arch?: string;
    env?: string;
  };
  uptimeSeconds?: number;
  uptime?: {
    processSeconds: number;
    formatted: string;
  };
  dependencies?: {
    core?: { database?: string };
    degraded?: { redis?: string; backgroundQueues?: string };
  };
  database: {
    status: 'CONNECTED' | 'DISCONNECTED' | 'HEALTHY' | 'DEGRADED';
    readyState: number;
    pingLatencyMs: number;
    latencyMs?: number;
    connectedHost: string;
    host?: string;
    name?: string;
    collectionsCount?: number;
  };
  memory: {
    rssMb: number;
    rssMB?: number;
    heapTotalMb: number;
    heapTotalMB?: number;
    heapUsedMb: number;
    heapUsedMB?: number;
    externalMb: number;
    externalMB?: number;
    systemFreeMB?: number;
    systemTotalMB?: number;
  };
  integrations?: {
    mongodbAtlas: string;
    paymentGateway: string;
    cloudStorage: string;
    cronJobs: string;
  };
  services?: Record<string, {
    configured?: boolean;
    status?: string;
    classification?: string;
    metrics?: Record<string, unknown>;
  }>;
  nodeVersion?: string;
}

export interface PlatformSettings {
  _id?: string;
  general: {
    platformName: string;
    supportEmail: string;
    supportPhone: string;
    defaultCurrency: string;
    defaultTimezone: string;
    allowSelfRegistration: boolean;
  };
  security: {
    maxLoginAttempts: number;
    lockoutDurationMinutes: number;
    sessionTimeoutMinutes: number;
    enforceMfaForSuperAdmin: boolean;
    jwtExpiryHours: number;
  };
  trial: {
    defaultTrialDays: number;
    allowTrialExtension: boolean;
    maxTrialExtensions: number;
    notifyExpiringDaysBefore: number;
  };
  maintenance: {
    isMaintenanceMode: boolean;
    maintenanceMessage: string;
    allowedIps: string[];
  };
  limits: {
    maxHostelsPerTenant: number;
    maxStudentsPerTenant: number;
    maxFileSizeMb: number;
  };
  updatedAt?: string;
}

export interface HostelMetricsData {
  totalHostels: number;
  activeHostels: number;
  totalCapacity: number;
  totalOccupied: number;
  totalVacant: number;
  overallOccupancyRate: number;
  totalStudentsEnrolled: number;
}

