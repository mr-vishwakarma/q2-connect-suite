import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedAdminRoute } from "@/components/auth/ProtectedAdminRoute";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
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
            <Route path="/admin/dashboard" element={<ProtectedAdminRoute><AdminDashboard /></ProtectedAdminRoute>} />
            <Route path="/admin/register-student" element={<ProtectedAdminRoute><RegisterStudent /></ProtectedAdminRoute>} />
            <Route path="/admin/complaints" element={<ProtectedAdminRoute><AdminComplaints /></ProtectedAdminRoute>} />
            <Route path="/admin/suggestions" element={<ProtectedAdminRoute><AdminSuggestions /></ProtectedAdminRoute>} />
            <Route path="/admin/students" element={<ProtectedAdminRoute><AllStudents /></ProtectedAdminRoute>} />
            <Route path="/admin/alerts" element={<ProtectedAdminRoute><AdminAlerts /></ProtectedAdminRoute>} />
            <Route path="/admin/admin-management" element={<ProtectedAdminRoute><AdminManagement /></ProtectedAdminRoute>} />
            <Route path="/admin/fees" element={<ProtectedAdminRoute><FeeManagement /></ProtectedAdminRoute>} />
            <Route path="/admin/rooms" element={<ProtectedAdminRoute><RoomManagement /></ProtectedAdminRoute>} />
            <Route path="/admin/notifications" element={<ProtectedAdminRoute><Notifications /></ProtectedAdminRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
