import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { HostelProvider } from "@/contexts/HostelContext";
import { ProtectedAdminRoute } from "@/components/auth/ProtectedAdminRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import ScrollToTop from "@/components/ScrollToTop";
import Index from "./pages/Index";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Login from "./pages/Login";
import AdminLogin from "./pages/AdminLogin";
import RegisterAdmin from "./pages/RegisterAdmin";
import Unauthorized from "./pages/Unauthorized";
import OurTeam from "./pages/OurTeam";
import StudentDashboard from "./pages/student/StudentDashboard";
import MessOff from "./pages/student/MessOff";
import Complaints from "./pages/student/Complaints";
import Suggestions from "./pages/student/Suggestions";
import FeeHistory from "./pages/student/FeeHistory";
import AdminDashboard from "./pages/admin/AdminDashboard";
import RegisterStudent from "./pages/admin/RegisterStudent";
import AdminComplaints from "./pages/admin/AdminComplaints";
import AdminSuggestions from "./pages/admin/AdminSuggestions";
import AllStudents from "./pages/admin/AllStudents";
import AdminManagement from "./pages/admin/AdminManagement";
import AdminAlerts from "./pages/admin/AdminAlerts";
import FeeManagement from "./pages/admin/FeeManagement";
import RoomManagement from "./pages/admin/RoomManagement";
import Notifications from "./pages/admin/Notifications";
import LeaveRequests from "./pages/admin/LeaveRequests";
import NotFound from "./pages/NotFound";

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
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <HostelProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/our-team" element={<OurTeam />} />
              <Route path="/login" element={<Login />} />
              <Route path="/admin-login" element={<AdminLogin />} />
              <Route path="/register-admin" element={<RegisterAdmin />} />
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
          </BrowserRouter>
        </HostelProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
