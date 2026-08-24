import { FeatureDefinition, FeatureKey, PlanTier } from '@/types/saas.types';

export const SUPER_ADMIN_ROUTES = {
  BASE: '/super-admin',
  DASHBOARD: '/super-admin/dashboard',
  ORGANIZATIONS: '/super-admin/organizations',
  ORGANIZATION_DETAIL: '/super-admin/organizations/:id',
  HOSTELS: '/super-admin/hostels',
  PLANS: '/super-admin/plans',
  FEATURES: '/super-admin/features',
  SUBSCRIPTIONS: '/super-admin/subscriptions',
  ANALYTICS: '/super-admin/analytics',
  AUDIT_LOGS: '/super-admin/audit-logs',
  SETTINGS: '/super-admin/settings',
} as const;

export const SAAS_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ORGANIZATION_OWNER: 'ORGANIZATION_OWNER',
  HOSTEL_ADMIN: 'HOSTEL_ADMIN',
  WARDEN: 'WARDEN',
  ACCOUNTANT: 'ACCOUNTANT',
  RECEPTIONIST: 'RECEPTIONIST',
  STAFF: 'STAFF',
  STUDENT: 'STUDENT',
} as const;

export const FEATURE_CATALOG: FeatureDefinition[] = [
  { key: 'student_management', name: 'Student Management', description: 'Student onboarding, profiles, room assignment & documents', category: 'core', defaultEnabled: true },
  { key: 'room_management', name: 'Room & Bed Management', description: 'Building, floor, room allocation & live occupancy tracking', category: 'core', defaultEnabled: true },
  { key: 'fee_management', name: 'Fee Collection & Matrix', description: 'Interactive student fee matrix, receipts, grace period & late fees', category: 'finance', defaultEnabled: true },
  { key: 'security_deposit', name: 'Security Deposits', description: 'Deposit ledgers, adjustments, refunds & tracking', category: 'finance', defaultEnabled: true },
  { key: 'expense_management', name: 'Expense Tracker', description: 'Hostel utility bills, vendor payments, maintenance expenses & cashflow', category: 'finance', defaultEnabled: true },
  { key: 'attendance', name: 'Attendance & Gate Passes', description: 'Student entry/exit pass approval and daily attendance', category: 'operations', defaultEnabled: true },
  { key: 'mess_management', name: 'Mess & Leave Requests', description: 'Mess-off rebate leaves, food rating widget & menu schedule', category: 'operations', defaultEnabled: true },
  { key: 'laundry', name: 'Laundry Booking', description: 'Time-slot booking system for washing machines', category: 'operations', defaultEnabled: true },
  { key: 'complaints', name: 'Complaints & Suggestions', description: 'Student ticketing system with resolution statuses', category: 'operations', defaultEnabled: true },
  { key: 'reports', name: 'Financial & Occupancy Reports', description: 'Exportable Excel & PDF financial ledgers', category: 'advanced', defaultEnabled: true },
  { key: 'advanced_analytics', name: 'Advanced Analytics & AI', description: 'Cohort analytics, forecasting & smart chatbot', category: 'advanced', defaultEnabled: false },
  { key: 'custom_branding', name: 'White-label & Custom Branding', description: 'Custom tenant logos, domain & receipt branding', category: 'advanced', defaultEnabled: false },
  { key: 'biometric_integration', name: 'Biometric Attendance Hardware', description: 'Hardware integration with gate access scanners', category: 'advanced', defaultEnabled: false },
  { key: 'api_access', name: 'External API & Webhooks', description: 'REST APIs and webhook triggers for third-party integrations', category: 'advanced', defaultEnabled: false },
];
