export const PUBLIC_ROUTES = {
  HOME: '/',
  ABOUT: '/about',
  CONTACT: '/contact',
  OUR_TEAM: '/our-team',
  LOGIN: '/login',
  REGISTER_ADMIN: '/register-admin',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  UNAUTHORIZED: '/unauthorized',
} as const;

export const ADMIN_ROUTES = {
  BASE: '/admin',
  DASHBOARD: '/admin/dashboard',
  ANALYTICS: '/admin/analytics',
  REGISTER_STUDENT: '/admin/register-student',
  ALL_STUDENTS: '/admin/students',
  FEES: '/admin/fees',
  ROOMS: '/admin/rooms',
  LEAVE_REQUESTS: '/admin/leave-requests',
  COMPLAINTS: '/admin/complaints',
  SUGGESTIONS: '/admin/suggestions',
  ALERTS: '/admin/alerts',
  ADMIN_MANAGEMENT: '/admin/admin-management',
  LAUNDRY: '/admin/laundry',
  SETTINGS: '/admin/settings',
  NOTIFICATIONS: '/admin/notifications',
} as const;

export const STUDENT_ROUTES = {
  DASHBOARD: '/student/dashboard',
  PROFILE: '/student/profile',
  MESS_OFF: '/student/mess-off',
  FEES: '/student/fee-history',
  COMPLAINTS: '/student/complaints',
  SUGGESTIONS: '/student/suggestions',
  LAUNDRY: '/student/laundry',
} as const;
