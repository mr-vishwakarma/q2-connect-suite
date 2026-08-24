import { Suspense, lazy } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { HostelProvider } from "@/contexts/HostelContext";
import { ProtectedAdminRoute } from "@/components/auth/ProtectedAdminRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import ScrollToTop from "@/components/ScrollToTop";

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) return null;

  if (user) {
    return <Navigate to={isAdmin ? "/admin/dashboard" : "/student/dashboard"} replace />;
  }

  return <>{children}</>;
}
const Index = lazy(() => import("./pages/Index"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Login = lazy(() => import("./pages/Login"));
const RegisterAdmin = lazy(() => import("./pages/RegisterAdmin"));
const Unauthorized = lazy(() => import("./pages/Unauthorized"));
const OurTeam = lazy(() => import("./pages/OurTeam"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword.tsx"));
const StudentDashboard = lazy(() => import("./pages/student/StudentDashboard"));
const Profile = lazy(() => import("./pages/student/Profile"));
const MessOff = lazy(() => import("./pages/student/MessOff"));
const Complaints = lazy(() => import("./pages/student/Complaints"));
const Suggestions = lazy(() => import("./pages/student/Suggestions"));
const Laundry = lazy(() => import("./pages/student/Laundry"));
const FeeHistory = lazy(() => import("./pages/student/FeeHistory"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const RegisterStudent = lazy(() => import("./pages/admin/RegisterStudent"));
const AdminComplaints = lazy(() => import("./pages/admin/AdminComplaints"));
const AdminSuggestions = lazy(() => import("./pages/admin/AdminSuggestions"));
const AllStudents = lazy(() => import("./pages/admin/AllStudents"));
const AdminManagement = lazy(() => import("./pages/admin/AdminManagement"));
const AdminAlerts = lazy(() => import("./pages/admin/AdminAlerts"));
const FeeManagement = lazy(() => import("./pages/admin/FeeManagement"));
const RoomManagement = lazy(() => import("./pages/admin/RoomManagement"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));
const Notifications = lazy(() => import("./pages/admin/Notifications"));
const LeaveRequests = lazy(() => import("./pages/admin/LeaveRequests"));
const LaundryManagement = lazy(() => import("./pages/admin/LaundryManagement"));
const ExpenseManagement = lazy(() => import("./pages/admin/ExpenseManagement"));
const CashflowAnalyzer = lazy(() => import("./pages/admin/CashflowAnalyzer"));
const AttendanceManagement = lazy(() => import("./pages/admin/AttendanceManagement"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SuperAdminDashboard = lazy(() => import("./pages/super-admin/SuperAdminDashboard"));
const OrganizationList = lazy(() => import("./pages/super-admin/OrganizationList"));
const OrganizationDetail = lazy(() => import("./pages/super-admin/OrganizationDetail"));
const PlanManagement = lazy(() => import("./pages/super-admin/PlanManagement"));
const FeatureCatalog = lazy(() => import("./pages/super-admin/FeatureCatalog"));
const AuditLogsView = lazy(() => import("./pages/super-admin/AuditLogsView"));

const queryClient = new QueryClient();

const adminTitles: Record<string, string> = {
  "/admin/dashboard": "",
  "/admin/analytics": "Analytics",
  "/admin/register-student": "Register Student",
  "/admin/complaints": "Complaints",
  "/admin/suggestions": "Suggestions",
  "/admin/students": "All Students",
  "/admin/alerts": "Alerts & Reminders",
  "/admin/admin-management": "Admin Management",
  "/admin/fees": "Fee Management",
  "/admin/rooms": "Room Management",
  "/admin/attendance": "Attendance & Gate Passes",
  "/admin/expenses": "Expense Tracker",
  "/admin/cashflow": "Cashflow & P&L",
  "/admin/leave-requests": "Leave Requests",
  "/admin/notifications": "Notifications",
};

const superAdminTitles: Record<string, string> = {
  "/super-admin/dashboard": "SaaS Control Center",
  "/super-admin/organizations": "Organizations",
  "/super-admin/hostels": "Hostel Branches",
  "/super-admin/plans": "Subscription Plans",
  "/super-admin/features": "Feature Catalog",
  "/super-admin/audit-logs": "Audit Logs",
};

import { ProtectedStudentRoute } from "@/components/auth/ProtectedStudentRoute";
import { ProtectedSuperAdminRoute } from "@/components/auth/ProtectedSuperAdminRoute";
import { SuperAdminLayout } from "@/components/super-admin/SuperAdminLayout";

function StudentShell() {
  return (
    <ProtectedStudentRoute>
      <Outlet />
    </ProtectedStudentRoute>
  );
}

function AdminShell() {
  const location = useLocation();
  const title = adminTitles[location.pathname] ?? "Admin Panel";

  return (
    <ProtectedAdminRoute>
      <AdminLayout title={title}>
        <Outlet />
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}

function SuperAdminShell() {
  const location = useLocation();
  const title = superAdminTitles[location.pathname] ?? "Super Admin";

  return (
    <ProtectedSuperAdminRoute>
      <SuperAdminLayout title={title}>
        <Outlet />
      </SuperAdminLayout>
    </ProtectedSuperAdminRoute>
  );
}

const App = () => (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
      <AuthProvider>
        <HostelProvider>
          <Toaster />
          <ToastContainer position="top-right" autoClose={3000} theme="dark" />
          <BrowserRouter>
            <ScrollToTop />
            <Suspense fallback={
              <div className="flex h-screen w-full items-center justify-center bg-background">
                <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
              </div>
            }>
            <Routes>
              <Route path="/" element={<PublicOnlyRoute><Index /></PublicOnlyRoute>} />
              <Route path="/about" element={<PublicOnlyRoute><About /></PublicOnlyRoute>} />
              <Route path="/contact" element={<PublicOnlyRoute><Contact /></PublicOnlyRoute>} />
              <Route path="/our-team" element={<PublicOnlyRoute><OurTeam /></PublicOnlyRoute>} />
              <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
              <Route path="/register-admin" element={<PublicOnlyRoute><RegisterAdmin /></PublicOnlyRoute>} />
              <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />
              <Route path="/reset-password" element={<PublicOnlyRoute><ResetPassword /></PublicOnlyRoute>} />
              <Route path="/unauthorized" element={<Unauthorized />} />

              {/* Student Protected Routes */}
              <Route path="/student" element={<StudentShell />}>
                <Route index element={<Navigate to="/student/dashboard" replace />} />
                <Route path="dashboard" element={<StudentDashboard />} />
                <Route path="profile" element={<Profile />} />
                <Route path="mess-off" element={<MessOff />} />
                <Route path="complaints" element={<Complaints />} />
                <Route path="suggestions" element={<Suggestions />} />
                <Route path="laundry" element={<Laundry />} />
                <Route path="fee-history" element={<FeeHistory />} />
              </Route>

              {/* Tenant Hostel Admin Protected Routes */}
              <Route path="/admin" element={<AdminShell />}>
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="analytics" element={<AdminAnalytics />} />
                <Route path="register-student" element={<RegisterStudent />} />
                <Route path="complaints" element={<AdminComplaints />} />
                <Route path="suggestions" element={<AdminSuggestions />} />
                <Route path="students" element={<AllStudents />} />
                <Route path="alerts" element={<AdminAlerts />} />
                <Route path="admin-management" element={<AdminManagement />} />
                <Route path="fees" element={<FeeManagement />} />
                <Route path="rooms" element={<RoomManagement />} />
                <Route path="attendance" element={<AttendanceManagement />} />
                <Route path="expenses" element={<ExpenseManagement />} />
                <Route path="cashflow" element={<CashflowAnalyzer />} />
                <Route path="leave-requests" element={<LeaveRequests />} />
                <Route path="laundry" element={<LaundryManagement />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="notifications" element={<Notifications />} />
              </Route>

              {/* Platform Super Admin Protected Routes */}
              <Route path="/super-admin" element={<SuperAdminShell />}>
                <Route index element={<Navigate to="/super-admin/dashboard" replace />} />
                <Route path="dashboard" element={<SuperAdminDashboard />} />
                <Route path="organizations" element={<OrganizationList />} />
                <Route path="organizations/:id" element={<OrganizationDetail />} />
                <Route path="hostels" element={<OrganizationList />} />
                <Route path="plans" element={<PlanManagement />} />
                <Route path="features" element={<FeatureCatalog />} />
                <Route path="audit-logs" element={<AuditLogsView />} />
              </Route>

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </BrowserRouter>
        </HostelProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

