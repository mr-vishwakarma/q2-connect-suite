const SAAS_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ORGANIZATION_OWNER: 'ORGANIZATION_OWNER',
  HOSTEL_ADMIN: 'HOSTEL_ADMIN',
  WARDEN: 'WARDEN',
  ACCOUNTANT: 'ACCOUNTANT',
  RECEPTIONIST: 'RECEPTIONIST',
  STAFF: 'STAFF',
  STUDENT: 'STUDENT',
};

const PLAN_TIERS = {
  STARTER: 'STARTER',
  PROFESSIONAL: 'PROFESSIONAL',
  ENTERPRISE: 'ENTERPRISE',
  CUSTOM: 'CUSTOM',
};

const DEFAULT_FEATURES = [
  'student_management',
  'room_management',
  'fee_management',
  'security_deposit',
  'expense_management',
  'attendance',
  'mess_management',
  'laundry',
  'complaints',
  'reports',
  'notifications',
];

const PERMISSIONS = {
  STUDENTS_VIEW: 'students.view',
  STUDENTS_CREATE: 'students.create',
  STUDENTS_UPDATE: 'students.update',
  STUDENTS_DELETE: 'students.delete',

  ROOMS_VIEW: 'rooms.view',
  ROOMS_MANAGE: 'rooms.manage',

  FEES_VIEW: 'fees.view',
  FEES_COLLECT: 'fees.collect',
  FEES_REFUND: 'fees.refund',

  EXPENSES_VIEW: 'expenses.view',
  EXPENSES_MANAGE: 'expenses.manage',

  REPORTS_VIEW: 'reports.view',
  ANALYTICS_VIEW: 'analytics.view',
  SETTINGS_MANAGE: 'settings.manage',
  STAFF_MANAGE: 'staff.manage',
};

module.exports = {
  SAAS_ROLES,
  PLAN_TIERS,
  DEFAULT_FEATURES,
  PERMISSIONS,
};
