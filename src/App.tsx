import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ScrollToTop from "@/components/ScrollToTop";
import Index from "./pages/Index";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Login from "./pages/Login";
import AdminLogin from "./pages/AdminLogin";
import OurTeam from "./pages/OurTeam";
import StudentDashboard from "./pages/student/StudentDashboard";
import MessOff from "./pages/student/MessOff";
import Complaints from "./pages/student/Complaints";
import Suggestions from "./pages/student/Suggestions";
import AdminDashboard from "./pages/admin/AdminDashboard";
import RegisterStudent from "./pages/admin/RegisterStudent";
import AdminAttendance from "./pages/admin/AdminAttendance";
import AdminComplaints from "./pages/admin/AdminComplaints";
import AdminSuggestions from "./pages/admin/AdminSuggestions";
import AllStudents from "./pages/admin/AllStudents";
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
            <Route path="/student/dashboard" element={<StudentDashboard />} />
            <Route path="/student/mess-off" element={<MessOff />} />
            <Route path="/student/complaints" element={<Complaints />} />
            <Route path="/student/suggestions" element={<Suggestions />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/register-student" element={<RegisterStudent />} />
            <Route path="/admin/attendance" element={<AdminAttendance />} />
            <Route path="/admin/complaints" element={<AdminComplaints />} />
            <Route path="/admin/suggestions" element={<AdminSuggestions />} />
            <Route path="/admin/students" element={<AllStudents />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
