import { Suspense, lazy } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { HostelProvider } from "@/contexts/HostelContext";
import { ProtectedAdminRoute } from "@/components/auth/ProtectedAdminRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ThemeProvider } from "@/components/theme-provider";
import ScrollToTop from "@/components/ScrollToTop";
const Index = lazy(() => import("./pages/Index"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Login = lazy(() => import("./pages/Login"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const RegisterAdmin = lazy(() => import("./pages/RegisterAdmin"));
const Unauthorized = lazy(() => import("./pages/Unauthorized"));
const OurTeam = lazy(() => import("./pages/OurTeam"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword.tsx"));
const StudentDashboard = lazy(() => import("./pages/student/StudentDashboard"));
const MessOff = lazy(() => import("./pages/student/MessOff"));
const Complaints = lazy(() => import("./pages/student/Complaints"));
const Suggestions = lazy(() => import("./pages/student/Suggestions"));
const FeeHistory = lazy(() => import("./pages/student/FeeHistory"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const RegisterStudent = lazy(() => import("./pages/admin/RegisterStudent"));
const AdminComplaints = lazy(() => import("./pages/admin/AdminComplaints"));
const AdminSuggestions = lazy(() => import("./pages/admin/AdminSuggestions"));
const AllStudents = lazy(() => import("./pages/admin/AllStudents"));
const AdminManagement = lazy(() => import("./pages/admin/AdminManagement"));
const AdminAlerts = lazy(() => import("./pages/admin/AdminAlerts"));
const FeeManagement = lazy(() => import("./pages/admin/FeeManagement"));
const RoomManagement = lazy(() => import("./pages/admin/RoomManagement"));
const Notifications = lazy(() => import("./pages/admin/Notifications"));
const LeaveRequests = lazy(() => import("./pages/admin/LeaveRequests"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const adminTitles: Record<string, string> = {
  "/admin/dashboard": "",
  "/admin/register-student": "Register Student",
  "/admin/complaints": "Complaints",
  "/admin/suggestions": "Suggestions",
  "/admin/students": "All Students",
  "/admin/alerts": "Alerts",
  "/admin/admin-management": "Admin Management",
  "/admin/fees": "Fee Management",
  "/admin/rooms": "Room Management",
  "/admin/leave-requests": "Leave Requests",
  "/admin/notifications": "Notifications",
};

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

const App = () => (
  <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
      <AuthProvider>
        <HostelProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <Suspense fallback={
              <div className="flex h-screen w-full items-center justify-center">
                <div className="animate-pulse flex flex-col items-center gap-4">
                  <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
                    <span className="text-primary-foreground font-bold text-xl">Q2</span>
                  </div>
                  <div className="h-4 w-32 bg-muted rounded"></div>
                </div>
              </div>
            }>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/our-team" element={<OurTeam />} />
              <Route path="/login" element={<Login />} />
              <Route path="/admin-login" element={<AdminLogin />} />
              <Route path="/register-admin" element={<RegisterAdmin />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/unauthorized" element={<Unauthorized />} />
              <Route path="/student/dashboard" element={<StudentDashboard />} />
              <Route path="/student/mess-off" element={<MessOff />} />
              <Route path="/student/complaints" element={<Complaints />} />
              <Route path="/student/suggestions" element={<Suggestions />} />
              <Route path="/student/fees" element={<FeeHistory />} />
              <Route path="/admin" element={<AdminShell />}>
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="register-student" element={<RegisterStudent />} />
                <Route path="complaints" element={<AdminComplaints />} />
                <Route path="suggestions" element={<AdminSuggestions />} />
                <Route path="students" element={<AllStudents />} />
                <Route path="alerts" element={<AdminAlerts />} />
                <Route path="admin-management" element={<AdminManagement />} />
                <Route path="fees" element={<FeeManagement />} />
                <Route path="rooms" element={<RoomManagement />} />
                <Route path="leave-requests" element={<LeaveRequests />} />
                <Route path="notifications" element={<Notifications />} />
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
  </ThemeProvider>
);

export default App;
