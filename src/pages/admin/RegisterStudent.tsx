import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useHostel } from '@/contexts/HostelContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserPlus,
  Calendar as CalendarIcon,
  Eye,
  EyeOff,
  Home,
  AlertCircle,
  Sparkles,
  User,
  Mail,
  Lock,
  Phone,
  Users,
  Bed,
  IndianRupee,
  Info,
  Send,
  Check,
  Edit3,
  Download,
  Printer,
  ChevronRight,
  GraduationCap,
  Bell,
  Wand2,
  CheckCircle2,
  Copy,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { StudentIDCard } from '@/components/admin/StudentIDCard';
import { InlineSkeletonList } from '@/components/ui/dashboard-skeleton';

interface Room {
  id: string;
  room_number: string;
  capacity: number;
  occupied_count: number;
  status: 'available' | 'full';
}

function RegisterStudentContent() {
  const { user, isAdmin, loading } = useAuth();
  const { selectedHostel, setSelectedHostel, hostels } = useHostel();
  const navigate = useNavigate();

  // Active view: 'form' (Image 1) or 'preview' (Image 2)
  const [viewMode, setViewMode] = useState<'form' | 'preview'>('form');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [roomError, setRoomError] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    parent_phone: '',
    fees: '',
    password: '',
    username: '',
  });
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [showPassword, setShowPassword] = useState(false);
  const [showPreviewPassword, setShowPreviewPassword] = useState(false);
  const [initialFeePaid, setInitialFeePaid] = useState(false);
  const [lastCreated, setLastCreated] = useState<{
    name: string;
    username: string;
    email: string;
    pass: string;
    studentCode?: string;
  } | null>(null);

  const [searchParams] = useSearchParams();
  const applicantIdParam = searchParams.get('applicantId');
  const [pendingApplicants, setPendingApplicants] = useState<any[]>([]);
  const [selectedApplicantId, setSelectedApplicantId] = useState<string>(applicantIdParam || '');

  const idCardRef = useRef<HTMLDivElement>(null);

  // Available branches list for pills in header
  const branchPills = hostels && hostels.length > 0
    ? hostels.map(h => h.name)
    : ['Q2', 'Q2.0', 'Q2.1'];

  const applyApplicantData = useCallback((applicant: any) => {
    if (!applicant) return;
    const userEmail = (applicant.email || '').toLowerCase().trim();
    setSelectedApplicantId(applicant.id);
    setFormData(prev => ({
      ...prev,
      name: applicant.name || '',
      email: userEmail,
      username: userEmail.split('@')[0] || userEmail,
      password: `${(applicant.name || 'Student').split(' ')[0]}@1234`,
      phone: applicant.phone || '',
    }));
    toast.info(`Auto-filled details for Google applicant ${applicant.name}`);
  }, []);

  useEffect(() => {
    const fetchPending = async () => {
      try {
        const res = await api.get('/students/pending-registrations');
        if (res.data?.success && res.data.data) {
          setPendingApplicants(res.data.data);
          if (applicantIdParam) {
            const found = res.data.data.find((a: any) => a.id === applicantIdParam);
            if (found) applyApplicantData(found);
          }
        }
      } catch (err) {
        console.error('Failed to load pending applicants', err);
      }
    };
    if (user && isAdmin) fetchPending();
  }, [user, isAdmin, applicantIdParam, applyApplicantData]);

  // Auto-generate temp password
  const handleAutoGeneratePassword = () => {
    const firstName = formData.name.split(' ')[0] || 'Student';
    const phonePart = formData.phone.replace(/\D/g, '').slice(-4) || '1234';
    const generated = `${firstName}@${phonePart}`;
    setFormData(prev => ({ ...prev, password: generated }));
    toast.info(`Generated password: ${generated}`);
  };

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate('/login?role=admin');
    }
  }, [user, isAdmin, loading, navigate]);

  // Fetch available rooms
  const fetchRooms = useCallback(async () => {
    try {
      const response = await api.get('/rooms', { params: { hostel: selectedHostel } });
      if (response.data?.success) {
        const mapped = response.data.data.map((r: any) => ({
          id: r._id,
          room_number: r.roomNumber,
          capacity: r.capacity,
          occupied_count: r.occupiedCount,
          status: r.status,
        }));
        setRooms(mapped);
      }
    } catch (err) {
      console.error('Error fetching rooms:', err);
      setRooms([]);
    }
  }, [selectedHostel]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // Validate room selection
  const validateRoom = (roomId: string) => {
    if (!roomId) {
      setRoomError('');
      return true;
    }

    const room = rooms.find(r => r.id === roomId);
    if (!room) {
      setRoomError('Room not found');
      return false;
    }

    if (room.occupied_count >= room.capacity) {
      setRoomError(`❌ No Capacity in Room ${room.room_number}`);
      return false;
    }

    setRoomError('');
    return true;
  };

  const handleRoomChange = (roomId: string) => {
    setSelectedRoomId(roomId);
    validateRoom(roomId);
  };

  // Validate form fields prior to preview or submission
  const validateForm = () => {
    if (!formData.name.trim()) {
      toast.error('Full Name is required');
      return false;
    }
    if (!formData.email.trim()) {
      toast.error('Student Email is required');
      return false;
    }
    if (!formData.username.trim()) {
      toast.error('User ID is required');
      return false;
    }
    if (!formData.password) {
      toast.error('Password is required');
      return false;
    }
    if (!formData.phone.trim()) {
      toast.error('Phone Number is required');
      return false;
    }
    if (!formData.parent_phone.trim()) {
      toast.error("Parent's Mobile Number is required");
      return false;
    }
    if (!selectedRoomId) {
      toast.error('Please select a Room Number');
      return false;
    }
    if (selectedRoomId && !validateRoom(selectedRoomId)) {
      toast.error(roomError || 'Selected room is not available');
      return false;
    }
    if (!formData.fees || parseFloat(formData.fees) <= 0) {
      toast.error('Monthly Fees is required');
      return false;
    }
    if (!startDate) {
      toast.error('Joining Date is required');
      return false;
    }
    return true;
  };

  // Transition to Preview View
  const handleGoToPreview = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!validateForm()) return;
    setViewMode('preview');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Submit Student Registration
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLastCreated(null);

    if (!validateForm()) {
      setViewMode('form');
      return;
    }

    const normalizedUsername = formData.username.toLowerCase().split('@')[0].trim();
    const selectedRoom = rooms.find(r => r.id === selectedRoomId);
    const roomNumber = selectedRoom?.room_number || '';
    const email = formData.email.toLowerCase().trim();

    setIsSubmitting(true);

    const endpoint = selectedApplicantId
      ? `/students/approve-and-register/${selectedApplicantId}`
      : '/students';

    try {
      const response = await api.post(endpoint, {
        name: formData.name,
        username: normalizedUsername,
        password: formData.password,
        phone: formData.phone,
        parentPhone: formData.parent_phone,
        roomNo: roomNumber,
        fees: formData.fees ? parseFloat(formData.fees) : 0,
        hostel: selectedHostel,
        startDate: startDate ? format(startDate, 'yyyy-MM-dd') : null,
        validDate: endDate ? format(endDate, 'yyyy-MM-dd') : null,
        email: email,
        initialFeePaid: initialFeePaid,
      });

      if (response.data?.success) {
        toast.success(`Student ${formData.name} registered successfully!`);
        setLastCreated({
          name: formData.name,
          username: normalizedUsername,
          email: email,
          pass: formData.password,
          studentCode: response.data?.data?.student?.studentCode,
        });

        if (selectedApplicantId) {
          setPendingApplicants(prev => prev.filter(a => a.id !== selectedApplicantId));
          setSelectedApplicantId('');
        }

        setFormData({
          name: '',
          email: '',
          phone: '',
          parent_phone: '',
          fees: '',
          password: '',
          username: '',
        });
        setSelectedRoomId('');
        setStartDate(new Date());
        setEndDate(undefined);
        setInitialFeePaid(false);
        fetchRooms();
        setViewMode('form');
      }
    } catch (error: any) {
      console.error('Error registering student:', error);
      toast.error(error.response?.data?.message || 'Failed to register student');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Download Student ID Card as high-resolution PNG image
  const handleDownloadIDCard = async () => {
    const cardElem = document.getElementById('student-id-card-element');
    if (!cardElem) return;
    try {
      toast.info('Generating high-resolution ID card...');
      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default || html2canvasModule;
      const canvas = await html2canvas(cardElem, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: null,
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${(formData.name || 'Student').replace(/\s+/g, '_')}_ID_Card.png`;
      link.href = dataUrl;
      link.click();
      toast.success('ID Card downloaded successfully!');
    } catch (err) {
      console.error('Download ID card error:', err);
      toast.error('Failed to download image. You can use Print ID Card instead.');
    }
  };

  // Print Student ID Card
  const handlePrintIDCard = () => {
    const cardElem = document.getElementById('student-id-card-element');
    if (!cardElem) return;
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (!printWindow) {
      toast.error('Please allow popups to print ID card');
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Student ID Card - ${formData.name || 'Student'}</title>
          <style>
            @page { size: auto; margin: 15mm; }
            body { margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; background: #fff; font-family: sans-serif; }
            @media print {
              body { padding: 0; background: transparent; }
              #student-id-card-element { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          ${cardElem.outerHTML}
          <script>
            setTimeout(() => { window.print(); window.close(); }, 600);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="py-8"><InlineSkeletonList rows={5} /></div>
    );
  }

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);
  const roomDisplayName = selectedRoom ? selectedRoom.room_number : (formData.username ? 'B-101' : 'Not assigned');

  return (
    <div className="w-full max-w-6xl mx-auto px-2 sm:px-4 py-3 space-y-6 text-foreground">
      {/* Top Header Row with Title, Branch Pills & Notifications */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/40">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Register Student
          </h1>
        </div>

        {/* Branch Pills Switcher */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#121622] p-1 rounded-xl border border-white/5 shadow-inner">
            {branchPills.map((branch) => {
              const isActive = (selectedHostel || 'Q2') === branch;
              return (
                <button
                  key={branch}
                  type="button"
                  onClick={() => setSelectedHostel(branch as any)}
                  className={cn(
                    'px-3.5 py-1 text-xs font-semibold rounded-lg transition-all duration-200',
                    isActive
                      ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  {branch}
                </button>
              );
            })}
          </div>

          <Link
            to="/admin/alerts"
            className="w-9 h-9 rounded-xl bg-[#121622] border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:border-red-500/30 transition-colors relative"
            title="Notifications & Alerts"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 ring-2 ring-background" />
          </Link>
        </div>
      </div>

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs font-medium text-zinc-400">
        <Link to="/admin/dashboard" className="hover:text-white transition-colors flex items-center gap-1">
          <Home className="w-3.5 h-3.5" />
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
        <Link to="/admin/students" className="hover:text-white transition-colors">
          Students
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
        {viewMode === 'form' ? (
          <span className="text-zinc-200 font-semibold">Register Student</span>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setViewMode('form')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Register Student
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
            <span className="text-zinc-200 font-semibold">Preview</span>
          </>
        )}
      </nav>

      {/* Google Pending Applicants Quick-Bar */}
      {pendingApplicants.length > 0 && viewMode === 'form' && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-amber-500 font-medium">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>
              <strong>{pendingApplicants.length}</strong> Google applicant registration{pendingApplicants.length === 1 ? '' : 's'} waiting for approval
            </span>
          </div>
          <div className="w-full sm:w-auto">
            <Select
              value={selectedApplicantId}
              onValueChange={(id) => {
                const applicant = pendingApplicants.find(a => a.id === id);
                if (applicant) applyApplicantData(applicant);
              }}
            >
              <SelectTrigger className="h-8 text-xs bg-black/40 border-amber-500/40 text-white w-full sm:w-[220px]">
                <SelectValue placeholder="Auto-fill applicant" />
              </SelectTrigger>
              <SelectContent className="bg-[#121622] border-border text-white">
                {pendingApplicants.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({a.hostel})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Success Notification Banner if just created */}
      {lastCreated && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 rounded-2xl border border-emerald-500/40 bg-emerald-950/20 space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h4 className="font-semibold text-emerald-400 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Student {lastCreated.name} Registered Successfully!
            </h4>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(`Name: ${lastCreated.name}\nUser ID: ${lastCreated.username}\nEmail: ${lastCreated.email}\nPassword: ${lastCreated.pass}`);
                toast.success('Credentials copied to clipboard!');
              }}
              className="h-7 text-xs border-emerald-500/40 bg-emerald-900/30 text-emerald-300 hover:bg-emerald-900/50 flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy Credentials
            </Button>
          </div>
          <div className="text-xs text-zinc-400 grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono">
            <div><span className="font-sans font-medium text-zinc-200">User ID:</span> {lastCreated.username}</div>
            <div><span className="font-sans font-medium text-zinc-200">Email:</span> {lastCreated.email}</div>
            <div><span className="font-sans font-medium text-zinc-200">Password:</span> {lastCreated.pass}</div>
          </div>
        </motion.div>
      )}

      {/* MAIN CONTENT: Switch between Form (Image 1) and Preview (Image 2) */}
      <AnimatePresence mode="wait">
        {viewMode === 'form' ? (
          /* =========================================================================
             VIEW 1: FORM (IMAGE 1)
             ========================================================================= */
          <motion.div
            key="form-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* Top Banner Row */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-600/30 shrink-0">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-white leading-tight">
                    Register New Student
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Add a new student to <span className="text-red-500 font-semibold">Hostel: {selectedHostel}</span>
                  </p>
                </div>
              </div>

              {/* Decorative "Building Better Tomorrows" Badge */}
              <div className="bg-[#121622] border border-white/5 rounded-2xl px-4 py-2.5 flex items-center gap-3.5 shadow-xl">
                <div className="w-10 h-10 rounded-xl bg-red-950/40 border border-red-500/20 flex items-center justify-center text-red-500 shrink-0">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <span className="block text-[11px] font-medium text-zinc-400">
                    Building
                  </span>
                  <span className="block text-xs font-bold text-red-500">
                    Better Tomorrows
                  </span>
                  <div className="w-7 h-0.5 bg-red-500 rounded-full mt-0.5" />
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* SECTION 1: Personal Information */}
              <div className="bg-[#121622] border border-white/5 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
                {/* Section Header */}
                <div className="flex items-center gap-3 pb-2 border-b border-white/5">
                  <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white leading-tight">
                      Personal Information
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Basic details about the student
                    </p>
                  </div>
                </div>

                {/* 2-Column Fields Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs font-semibold text-zinc-300">
                      Full Name <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Enter full name"
                        required
                        className="bg-[#181d2a] border-border/40 pl-10 text-white placeholder:text-zinc-500 focus:border-red-500"
                      />
                    </div>
                  </div>

                  {/* Student Email */}
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-semibold text-zinc-300">
                      Student Email <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="student@example.com"
                        required
                        className="bg-[#181d2a] border-border/40 pl-10 text-white placeholder:text-zinc-500 focus:border-red-500"
                      />
                    </div>
                  </div>

                  {/* User ID */}
                  <div className="space-y-1.5">
                    <Label htmlFor="username" className="text-xs font-semibold text-zinc-300">
                      User ID (for login) <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-bold pointer-events-none">
                        @
                      </span>
                      <Input
                        id="username"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        placeholder="e.g. karan123"
                        required
                        className="bg-[#181d2a] border-border/40 pl-10 text-white placeholder:text-zinc-500 focus:border-red-500"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-xs font-semibold text-zinc-300">
                      Password <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="Enter or generate"
                        required
                        className="bg-[#181d2a] border-border/40 pl-10 pr-10 text-white placeholder:text-zinc-500 focus:border-red-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {/* Auto-Generate Button */}
                    <div className="flex justify-end pt-0.5">
                      <button
                        type="button"
                        onClick={handleAutoGeneratePassword}
                        className="text-xs font-semibold text-red-500 hover:text-red-400 flex items-center gap-1 transition-colors"
                      >
                        <Wand2 className="w-3.5 h-3.5 text-red-500" />
                        Auto-Generate
                      </button>
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs font-semibold text-zinc-300">
                      Phone Number <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative flex items-center">
                      <div className="flex items-center gap-1.5 bg-[#141824] border border-border/40 border-r-0 rounded-l-md px-3 h-10 text-zinc-300 text-xs font-semibold">
                        <Phone className="w-3.5 h-3.5 text-zinc-400" />
                        <span>+91</span>
                      </div>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="Enter mobile number"
                        required
                        className="bg-[#181d2a] border-border/40 rounded-l-none text-white placeholder:text-zinc-500 focus:border-red-500"
                      />
                    </div>
                  </div>

                  {/* Parent's Mobile Number */}
                  <div className="space-y-1.5">
                    <Label htmlFor="parent_phone" className="text-xs font-semibold text-zinc-300">
                      Parent's Mobile Number <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative flex items-center">
                      <div className="flex items-center gap-1.5 bg-[#141824] border border-border/40 border-r-0 rounded-l-md px-3 h-10 text-zinc-300 text-xs font-semibold">
                        <Users className="w-3.5 h-3.5 text-zinc-400" />
                        <span>+91</span>
                      </div>
                      <Input
                        id="parent_phone"
                        value={formData.parent_phone}
                        onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })}
                        placeholder="Enter parent's number"
                        required
                        className="bg-[#181d2a] border-border/40 rounded-l-none text-white placeholder:text-zinc-500 focus:border-red-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Academic & Hostel Details */}
              <div className="bg-[#121622] border border-white/5 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
                {/* Section Header */}
                <div className="flex items-center gap-3 pb-2 border-b border-white/5">
                  <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 shrink-0">
                    <Home className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white leading-tight">
                      Academic & Hostel Details
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Assign room and fee details
                    </p>
                  </div>
                </div>

                {/* 2-Column Fields Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                  {/* Room Number */}
                  <div className="space-y-1.5">
                    <Label htmlFor="room" className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                      <Bed className="w-3.5 h-3.5 text-zinc-400" />
                      Room Number <span className="text-red-500">*</span>
                    </Label>
                    <Select value={selectedRoomId} onValueChange={handleRoomChange}>
                      <SelectTrigger className="bg-[#181d2a] border-border/40 text-white focus:border-red-500">
                        <SelectValue placeholder="Select a room" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#121622] border-border text-white">
                        {rooms.length === 0 ? (
                          <SelectItem value="none" disabled>No rooms available. Add rooms first.</SelectItem>
                        ) : (
                          rooms.map((room) => (
                            <SelectItem
                              key={room.id}
                              value={room.id}
                              disabled={room.status === 'full'}
                            >
                              Room {room.room_number} ({room.occupied_count}/{room.capacity})
                              {room.status === 'full' ? ' - Full' : ' - Available'}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {roomError && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {roomError}
                      </p>
                    )}
                  </div>

                  {/* Monthly Fees */}
                  <div className="space-y-1.5">
                    <Label htmlFor="fees" className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                      <IndianRupee className="w-3.5 h-3.5 text-zinc-400" />
                      Monthly Fees (₹) <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-semibold pointer-events-none">
                        ₹
                      </span>
                      <Input
                        id="fees"
                        type="number"
                        value={formData.fees}
                        onChange={(e) => setFormData({ ...formData, fees: e.target.value })}
                        placeholder="e.g., 5000"
                        required
                        className="bg-[#181d2a] border-border/40 pl-9 text-white placeholder:text-zinc-500 focus:border-red-500"
                      />
                    </div>
                  </div>

                  {/* Joining Date */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5 text-zinc-400" />
                      Joining Date <span className="text-red-500">*</span>
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal bg-[#181d2a] border-border/40 text-white hover:bg-[#1f2536]",
                            !startDate && "text-zinc-500"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 text-zinc-400" />
                          {startDate ? format(startDate, "MMMM do, yyyy") : "Select joining date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-[#121622] border-border text-white" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* End Date (Optional) */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5 text-zinc-400" />
                      End Date <span className="text-zinc-500 font-normal">(Optional)</span>
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal bg-[#181d2a] border-border/40 text-white hover:bg-[#1f2536]",
                            !endDate && "text-zinc-500"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 text-zinc-400" />
                          {endDate ? format(endDate, "MMMM do, yyyy") : "Select end date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-[#121622] border-border text-white" align="start">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Optional Initial Fee Paid Switch */}
                {formData.fees && parseFloat(formData.fees) > 0 && (
                  <div className="pt-2 flex items-center justify-between border-t border-white/5">
                    <div className="text-xs">
                      <span className="font-semibold text-zinc-200">First Month Fee Status: </span>
                      <span className={initialFeePaid ? 'text-emerald-400 font-bold' : 'text-zinc-400'}>
                        {initialFeePaid ? 'Mark as Paid & Generate Receipt' : 'Unpaid (Due on check-in)'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInitialFeePaid(!initialFeePaid)}
                      className={cn(
                        'relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
                        initialFeePaid ? 'bg-emerald-500' : 'bg-zinc-700'
                      )}
                    >
                      <span
                        className={cn(
                          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out',
                          initialFeePaid ? 'translate-x-5' : 'translate-x-0'
                        )}
                      />
                    </button>
                  </div>
                )}
              </div>

              {/* Informational Notice Banner */}
              <div className="bg-[#121622] border border-white/5 rounded-2xl p-4 flex items-center gap-3.5 text-xs text-zinc-400 shadow-lg">
                <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-zinc-300 shrink-0">
                  <Info className="w-4 h-4" />
                </div>
                <div>
                  The student will use their <strong className="text-white">User ID</strong> (or <strong className="text-white">Email</strong>) and this <strong className="text-white">Password</strong> to log in directly.
                </div>
              </div>

              {/* Action Buttons Bar */}
              <div className="flex items-center justify-between gap-4 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/admin/students')}
                  className="px-6 h-11 rounded-xl bg-transparent border-white/10 text-white hover:bg-white/5 hover:text-white"
                >
                  Cancel
                </Button>

                <div className="flex items-center gap-3">
                  {/* Preview Button (as requested) */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGoToPreview}
                    className="px-5 h-11 rounded-xl bg-[#181d2a] border-white/10 text-white hover:bg-[#202738] flex items-center gap-2 shadow-lg"
                  >
                    <Eye className="w-4 h-4 text-red-400" />
                    Preview Details
                  </Button>

                  {/* Register Student Button */}
                  <Button
                    type="submit"
                    disabled={isSubmitting || !!roomError}
                    className="px-6 h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold shadow-lg shadow-red-600/30 flex items-center gap-2 transition-all"
                  >
                    <Send className="w-4 h-4" />
                    {isSubmitting ? 'Registering...' : 'Register Student'}
                  </Button>
                </div>
              </div>
            </form>
          </motion.div>
        ) : (
          /* =========================================================================
             VIEW 2: REVIEW & CONFIRM / PREVIEW (IMAGE 2)
             ========================================================================= */
          <motion.div
            key="preview-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* Top Banner Row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-600/30 shrink-0">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-white leading-tight">
                    Review & Confirm
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Please verify the student details before registration.
                  </p>
                </div>
              </div>

              {/* Edit Details Button */}
              <Button
                type="button"
                variant="outline"
                onClick={() => setViewMode('form')}
                className="h-10 px-4 rounded-xl bg-[#121622] border-white/10 text-white hover:bg-white/10 flex items-center gap-2 text-xs font-semibold shadow-md"
              >
                <Edit3 className="w-4 h-4 text-zinc-400" />
                Edit Details
              </Button>
            </div>

            {/* 2-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* LEFT COLUMN: Student ID Preview */}
              <div className="lg:col-span-5 bg-[#121622] border border-white/5 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">
                    Student ID Preview
                  </h3>
                  <p className="text-xs text-zinc-400">
                    This is how the student ID card will look.
                  </p>
                </div>

                {/* Rendered ID Card */}
                <div className="py-2">
                  <StudentIDCard
                    ref={idCardRef}
                    name={formData.name || 'Karan Sharma'}
                    email={formData.email || 'karan@example.com'}
                    username={formData.username || 'karan123'}
                    roomNo={roomDisplayName}
                    hostel={selectedHostel || 'Q2'}
                    fees={formData.fees || '5000'}
                    startDate={startDate}
                  />
                </div>

                {/* Action Buttons: Download & Print */}
                <div className="space-y-2.5 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDownloadIDCard}
                    className="w-full h-11 rounded-xl bg-[#181d2a] border-white/10 text-white hover:bg-[#202738] flex items-center justify-center gap-2 font-semibold text-xs shadow-md"
                  >
                    <Download className="w-4 h-4 text-zinc-400" />
                    Download ID Card
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrintIDCard}
                    className="w-full h-11 rounded-xl bg-[#181d2a] border-white/10 text-white hover:bg-[#202738] flex items-center justify-center gap-2 font-semibold text-xs shadow-md"
                  >
                    <Printer className="w-4 h-4 text-zinc-400" />
                    Print ID Card
                  </Button>
                </div>
              </div>

              {/* RIGHT COLUMN: Complete Student Details */}
              <div className="lg:col-span-7 space-y-5">
                <div className="bg-[#121622] border border-white/5 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
                  <div>
                    <h3 className="text-base font-bold text-white leading-tight">
                      Complete Student Details
                    </h3>
                    <p className="text-xs text-zinc-400">
                      All information entered in the registration form.
                    </p>
                  </div>

                  {/* Sub-Card 1: Personal Information */}
                  <div className="bg-[#181d2a]/70 border border-white/5 rounded-xl p-4 sm:p-5 space-y-4">
                    <div className="flex items-center gap-2.5 pb-2 border-b border-white/5">
                      <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Personal Information
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      {/* Full Name */}
                      <div className="space-y-1">
                        <span className="flex items-center gap-1.5 text-zinc-400 font-medium">
                          <User className="w-3.5 h-3.5 text-zinc-500" />
                          Full Name
                        </span>
                        <p className="text-sm font-semibold text-white pl-5">
                          {formData.name || 'Karan Sharma'}
                        </p>
                      </div>

                      {/* Student Email */}
                      <div className="space-y-1">
                        <span className="flex items-center gap-1.5 text-zinc-400 font-medium">
                          <Mail className="w-3.5 h-3.5 text-zinc-500" />
                          Student Email
                        </span>
                        <p className="text-sm font-semibold text-white pl-5 truncate">
                          {formData.email || 'karan@example.com'}
                        </p>
                      </div>

                      {/* User ID */}
                      <div className="space-y-1">
                        <span className="flex items-center gap-1.5 text-zinc-400 font-medium">
                          <span className="text-zinc-500 font-bold">@</span>
                          User ID (for login)
                        </span>
                        <p className="text-sm font-semibold text-white pl-5 font-mono">
                          {formData.username || 'karan123'}
                        </p>
                      </div>

                      {/* Password */}
                      <div className="space-y-1">
                        <span className="flex items-center gap-1.5 text-zinc-400 font-medium">
                          <Lock className="w-3.5 h-3.5 text-zinc-500" />
                          Password
                        </span>
                        <div className="flex items-center gap-2 pl-5">
                          <p className="text-sm font-semibold text-white font-mono">
                            {showPreviewPassword ? formData.password : '••••••••'}
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowPreviewPassword(!showPreviewPassword)}
                            className="text-zinc-500 hover:text-white transition-colors"
                            title={showPreviewPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPreviewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Phone Number */}
                      <div className="space-y-1">
                        <span className="flex items-center gap-1.5 text-zinc-400 font-medium">
                          <Phone className="w-3.5 h-3.5 text-zinc-500" />
                          Phone Number
                        </span>
                        <p className="text-sm font-semibold text-white pl-5 font-mono">
                          +91 {formData.phone || '98765 43210'}
                        </p>
                      </div>

                      {/* Parent Phone */}
                      <div className="space-y-1">
                        <span className="flex items-center gap-1.5 text-zinc-400 font-medium">
                          <Users className="w-3.5 h-3.5 text-zinc-500" />
                          Parent's Mobile Number
                        </span>
                        <p className="text-sm font-semibold text-white pl-5 font-mono">
                          +91 {formData.parent_phone || '91234 56789'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Sub-Card 2: Academic & Hostel Details */}
                  <div className="bg-[#181d2a]/70 border border-white/5 rounded-xl p-4 sm:p-5 space-y-4">
                    <div className="flex items-center gap-2.5 pb-2 border-b border-white/5">
                      <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500">
                        <Home className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Academic & Hostel Details
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      {/* Room Number */}
                      <div className="space-y-1">
                        <span className="flex items-center gap-1.5 text-zinc-400 font-medium">
                          <Bed className="w-3.5 h-3.5 text-zinc-500" />
                          Room Number
                        </span>
                        <p className="text-sm font-semibold text-white pl-5">
                          {roomDisplayName}
                        </p>
                      </div>

                      {/* Monthly Fees */}
                      <div className="space-y-1">
                        <span className="flex items-center gap-1.5 text-zinc-400 font-medium">
                          <IndianRupee className="w-3.5 h-3.5 text-zinc-500" />
                          Monthly Fees
                        </span>
                        <p className="text-sm font-semibold text-white pl-5 font-mono">
                          ₹{parseFloat(formData.fees || '5000').toLocaleString('en-IN')}
                        </p>
                      </div>

                      {/* Joining Date */}
                      <div className="space-y-1">
                        <span className="flex items-center gap-1.5 text-zinc-400 font-medium">
                          <CalendarIcon className="w-3.5 h-3.5 text-zinc-500" />
                          Joining Date
                        </span>
                        <p className="text-sm font-semibold text-white pl-5">
                          {startDate ? format(startDate, 'dd MMMM yyyy') : '11 September 2026'}
                        </p>
                      </div>

                      {/* End Date */}
                      <div className="space-y-1">
                        <span className="flex items-center gap-1.5 text-zinc-400 font-medium">
                          <CalendarIcon className="w-3.5 h-3.5 text-zinc-500" />
                          End Date
                        </span>
                        <p className="text-sm font-semibold text-white pl-5">
                          {endDate ? format(endDate, 'dd MMMM yyyy') : 'Not set'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Informational Notice Banner */}
                  <div className="bg-[#181d2a]/50 border border-white/5 rounded-xl p-3.5 flex items-center gap-3 text-xs text-zinc-400">
                    <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-zinc-300 shrink-0">
                      <Info className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      The student will use their <strong className="text-white">User ID</strong> (or <strong className="text-white">Email</strong>) and this <strong className="text-white">Password</strong> to log in directly.
                    </div>
                  </div>

                  {/* Bottom Action Bar */}
                  <div className="flex items-center justify-between gap-4 pt-3 border-t border-white/5">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setViewMode('form')}
                      className="px-6 h-11 rounded-xl bg-transparent border-white/10 text-white hover:bg-white/5"
                    >
                      Back
                    </Button>

                    <Button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleSubmit()}
                      className="px-7 h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold shadow-lg shadow-red-600/30 flex items-center gap-2 transition-all"
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                      {isSubmitting ? 'Registering...' : 'Confirm & Register'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default RegisterStudentContent;