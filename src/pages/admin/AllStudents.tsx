import { InlineSkeletonList } from '@/components/ui/dashboard-skeleton';
import { EditStudentDialog } from './components/EditStudentDialog';
import { CompleteRegistrationDialog } from './components/CompleteRegistrationDialog';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useHostel } from '@/contexts/HostelContext';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import {
  Users,
  Search,
  Trash2,
  Pencil,
  CalendarIcon,
  UserCheck,
  UserPlus,
  UserX,
  CheckCircle2,
  Clock,
  Building,
  ShieldCheck,
  Phone,
  Mail,
  RefreshCw,
} from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface Student {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  room_no: string;
  fees: number;
  start_date: string;
  valid_date: string;
  username: string;
  created_at: string;
}

interface PendingApplicant {
  id: string;
  name: string;
  email: string;
  phone: string;
  hostel: string;
  picture?: string;
  submittedAt: string;
  registrationStatus: string;
}

// Helper function to get status based on valid_date
function getStudentStatus(validDate: string | null): { label: string; type: 'expired' | 'warning' | 'active' } {
  if (!validDate) return { label: 'N/A', type: 'active' };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const valid = parseISO(validDate);
  const daysLeft = differenceInDays(valid, today);
  
  if (daysLeft < 0) {
    return { label: 'Expired', type: 'expired' };
  } else if (daysLeft <= 5) {
    return { label: `${daysLeft} days left`, type: 'warning' };
  }
  return { label: 'Active', type: 'active' };
}

export default function AllStudents() {
  const { user, isAdmin, loading } = useAuth();
  const { selectedHostel } = useHostel();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    room_no: '',
    fees: '',
    username: '',
  });
  const [editStartDate, setEditStartDate] = useState<Date | undefined>();
  const [editEndDate, setEditEndDate] = useState<Date | undefined>();

  // Approval Workflow State
  const [activeTab, setActiveTab] = useState<'active' | 'pending'>('active');
  const [pendingRegistrations, setPendingRegistrations] = useState<PendingApplicant[]>([]);
  const [pendingBranchFilter, setPendingBranchFilter] = useState<'All' | 'Q2' | 'Q2.0' | 'Q2.1'>('All');
  const [isPendingLoading, setIsPendingLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [registeringApplicant, setRegisteringApplicant] = useState<PendingApplicant | null>(null);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate('/admin-login');
    }
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset to page 1 on new search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchStudents = useCallback(async () => {
    try {
      setIsLoading(prev => prev);
      const response = await api.get('/students', { 
        params: { 
          hostel: selectedHostel, 
          search: debouncedSearch,
          page: currentPage,
          limit: 20,
          _t: Date.now() 
        } 
      });
      if (response.data?.success) {
        const mapped = response.data.data
          .filter((s: any) => !deletedIdsRef.current.has(s._id))
          .map((s: any) => ({
            id: s._id,
            user_id: s.userId,
            name: s.name,
            phone: s.phone || '',
            room_no: s.roomNo || '',
            fees: s.fees || 0,
            start_date: s.startDate || '',
            valid_date: s.validDate || '',
            username: s.username,
            created_at: s.createdAt,
          }));
        setStudents(mapped);
        setTotalPages(response.data.totalPages || 1);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
      toast.error('Failed to fetch students');
    } finally {
      setIsLoading(false);
    }
  }, [selectedHostel, debouncedSearch, currentPage]);

  const fetchPendingRegistrations = useCallback(async (filterOverride?: string) => {
    try {
      setIsPendingLoading(true);
      const branchParam = filterOverride !== undefined ? filterOverride : pendingBranchFilter;
      const res = await api.get('/students/pending-registrations', {
        params: {
          hostel: branchParam === 'All' ? undefined : branchParam,
          _t: Date.now(),
        },
      });
      if (res.data?.success) {
        setPendingRegistrations(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load pending registrations:', err);
    } finally {
      setIsPendingLoading(false);
    }
  }, [pendingBranchFilter]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchStudents();
    }
  }, [user, isAdmin, fetchStudents]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchPendingRegistrations();
    }
  }, [user, isAdmin, fetchPendingRegistrations]);

  const handleApproveRegistration = async (applicantId: string, applicantName: string) => {
    try {
      setActionLoadingId(applicantId);
      const res = await api.post(`/students/approve-registration/${applicantId}`);
      if (res.data?.success) {
        toast.success(`Registration approved for ${applicantName}! The resident can now sign in with Google to set their credentials.`);
        setPendingRegistrations((prev) => prev.filter((item) => item.id !== applicantId));
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to approve registration');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectRegistration = async (applicantId: string, applicantName: string) => {
    const reason = window.prompt(`Enter reason for declining ${applicantName}'s registration (optional):`, 'Does not meet current room vacancy requirements');
    if (reason === null) return;

    try {
      setActionLoadingId(applicantId);
      const res = await api.post(`/students/reject-registration/${applicantId}`, { reason });
      if (res.data?.success) {
        toast.info(`Declined registration for ${applicantName}.`);
        setPendingRegistrations((prev) => prev.filter((item) => item.id !== applicantId));
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to decline registration');
    } finally {
      setActionLoadingId(null);
    }
  };

  const openEditDialog = (student: Student) => {
    setEditingStudent(student);
    setEditForm({
      name: student.name || '',
      room_no: student.room_no || '',
      fees: student.fees?.toString() || '',
      username: student.username || '',
    });
    setEditStartDate(student.start_date ? new Date(student.start_date) : undefined);
    setEditEndDate(student.valid_date ? new Date(student.valid_date) : undefined);
    setIsDialogOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    setIsSubmitting(true);

    try {
      await api.put(`/students/${editingStudent.id}`, {
        name: editForm.name,
        roomNo: editForm.room_no,
        fees: parseFloat(editForm.fees) || null,
        username: editForm.username.toLowerCase(),
        startDate: editStartDate ? format(editStartDate, 'yyyy-MM-dd') : null,
        validDate: editEndDate ? format(editEndDate, 'yyyy-MM-dd') : null,
      });

      toast.success('Student updated successfully');
      setIsDialogOpen(false);
      setEditingStudent(null);
      fetchStudents();
    } catch (error: any) {
      console.error('Error updating student:', error);
      toast.error(error.response?.data?.message || 'Failed to update student');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteStudent = async (studentId: string) => {
    if (!confirm('Are you sure you want to delete this student?')) return;

    try {
      // Track this ID so it never comes back from any future fetch
      deletedIdsRef.current.add(studentId);
      // Immediately remove from UI
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
      await api.delete(`/students/${studentId}`);
      toast.success('Student deleted successfully');
    } catch (error) {
      console.error('Error deleting student:', error);
      toast.error('Failed to delete student');
      // Undo: allow it back and refetch real state
      deletedIdsRef.current.delete(studentId);
      fetchStudents();
    }
  };

  const filteredStudents = students; // Filtering is now done on the server

  if (loading || isLoading) {
    return (
      <div className="py-8"><InlineSkeletonList rows={5} /></div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-foreground">
              All Students - {selectedHostel}
            </h2>
            <p className="text-muted-foreground text-sm">{filteredStudents.length} students</p>
          </div>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, or room..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary border-border w-full"
          />
        </div>
      </div>

      {/* Tabs Switcher: Active Students vs Pending Registrations */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={cn(
            "px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2",
            activeTab === 'active'
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          )}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Active Residents ({students.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pending')}
          className={cn(
            "px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 relative",
            activeTab === 'pending'
              ? "bg-amber-500 text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          )}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Pending Approvals</span>
          {pendingRegistrations.length > 0 && (
            <span className={cn(
              "px-1.5 py-0.2 rounded-full text-[10px] font-extrabold",
              activeTab === 'pending' ? "bg-white text-amber-600" : "bg-amber-500 text-white"
            )}>
              {pendingRegistrations.length}
            </span>
          )}
        </button>

        {activeTab === 'pending' && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fetchPendingRegistrations()}
            disabled={isPendingLoading}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground h-8 gap-1.5"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isPendingLoading && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        )}
      </div>

      {activeTab === 'pending' ? (
        /* PENDING REGISTRATIONS VIEW */
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Branch Quick Filter for Pending Approvals */}
          <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
            <div className="flex items-center gap-1.5 bg-secondary/50 p-1 rounded-xl border border-border/60">
              {(['All', 'Q2', 'Q2.0', 'Q2.1'] as const).map((branch) => (
                <button
                  key={branch}
                  type="button"
                  onClick={() => setPendingBranchFilter(branch)}
                  className={cn(
                    "px-3 py-1 text-xs font-semibold rounded-lg transition-all",
                    pendingBranchFilter === branch
                      ? "bg-card text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {branch === 'All' ? 'All Branches' : branch}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Showing {pendingRegistrations.length} pending applicant{pendingRegistrations.length === 1 ? '' : 's'}
            </p>
          </div>

          {isPendingLoading ? (
            <div className="py-8"><InlineSkeletonList rows={3} /></div>
          ) : pendingRegistrations.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                <h3 className="font-bold text-foreground text-sm">No Pending Registrations</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  All new resident applications have been approved or processed. When someone signs up via Google, their application will appear here for verification.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card border-border overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground text-xs">Applicant</TableHead>
                      <TableHead className="text-muted-foreground text-xs">Google Email</TableHead>
                      <TableHead className="text-muted-foreground text-xs">Phone</TableHead>
                      <TableHead className="text-muted-foreground text-xs">Hostel Branch</TableHead>
                      <TableHead className="text-muted-foreground text-xs">Submitted At</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-right">Review Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRegistrations.map((applicant) => (
                      <TableRow key={applicant.id} className="border-border hover:bg-secondary/40">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2.5">
                            {applicant.picture ? (
                              <img
                                src={applicant.picture}
                                alt={applicant.name}
                                className="w-8 h-8 rounded-full border border-border object-cover shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                                {applicant.name.charAt(0)}
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-foreground text-xs">{applicant.name}</div>
                              <span className="text-[10px] text-emerald-500 font-medium flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Google Verified
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {applicant.email}
                        </TableCell>
                        <TableCell className="text-xs text-foreground font-mono">
                          {applicant.phone || 'N/A'}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="text-primary border-primary/30 font-semibold">
                            {applicant.hostel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {applicant.submittedAt ? format(new Date(applicant.submittedAt), 'PP p') : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => setRegisteringApplicant(applicant)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 px-3 text-xs rounded-lg gap-1.5 shadow-sm"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>Register & Approve</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actionLoadingId === applicant.id}
                              onClick={() => handleRejectRegistration(applicant.id, applicant.name)}
                              className="border-destructive/40 text-destructive hover:bg-destructive/10 h-8 px-2.5 text-xs rounded-lg gap-1"
                            >
                              <UserX className="w-3.5 h-3.5" />
                              <span>Decline</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </motion.div>
      ) : (
        /* ACTIVE STUDENTS VIEW */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Mobile Card View */}
          <div className="block md:hidden space-y-3">
            {filteredStudents.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-12 text-center">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {searchQuery ? 'No students match your search' : `No students found in ${selectedHostel}`}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredStudents.map((student) => {
                const status = getStudentStatus(student.valid_date);
                return (
                  <Card key={student.id} className="bg-card border-border">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-foreground">{student.name}</p>
                          <p className="text-xs text-muted-foreground">{student.username || '-'}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEditDialog(student)} className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 h-8 w-8 p-0">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteStudent(student.id)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Phone</p>
                          <p className="text-foreground">{student.phone || '-'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Room</p>
                          <Badge variant="outline" className="text-primary border-primary/30">{student.room_no || 'N/A'}</Badge>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Fees</p>
                          <p className="text-foreground">{student.fees ? `₹${student.fees.toLocaleString('en-IN')}` : '-'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Status</p>
                          <span className={cn(
                            "font-medium",
                            status.type === 'expired' && "text-destructive",
                            status.type === 'warning' && "text-orange-500",
                            status.type === 'active' && "text-foreground"
                          )}>{status.label}</span>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Start</p>
                          <p className="text-foreground text-xs">{student.start_date ? new Date(student.start_date).toLocaleDateString() : '-'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">End</p>
                          <p className="text-foreground text-xs">{student.valid_date ? new Date(student.valid_date).toLocaleDateString() : '-'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* Desktop Table View */}
          <Card className="bg-card border-border overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-secondary/50">
                    <TableHead className="text-foreground font-bold">Name</TableHead>
                    <TableHead className="text-foreground font-bold">User ID</TableHead>
                    <TableHead className="text-foreground font-bold hidden lg:table-cell">Phone</TableHead>
                    <TableHead className="text-foreground font-bold">Room</TableHead>
                    <TableHead className="text-foreground font-bold">Fees</TableHead>
                    <TableHead className="text-foreground font-bold hidden lg:table-cell">Start Date</TableHead>
                    <TableHead className="text-foreground font-bold">End Date</TableHead>
                    <TableHead className="text-foreground font-bold">Status</TableHead>
                    <TableHead className="text-foreground font-bold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => {
                    const status = getStudentStatus(student.valid_date);
                    return (
                      <TableRow key={student.id} className="border-border hover:bg-secondary/30">
                        <TableCell className="font-semibold text-foreground">{student.name}</TableCell>
                        <TableCell className="text-foreground font-medium">{student.username || '-'}</TableCell>
                        <TableCell className="text-foreground font-medium hidden lg:table-cell">{student.phone || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-primary border-primary/30 font-bold">
                            {student.room_no || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-foreground font-semibold">
                          {student.fees ? `₹${student.fees.toLocaleString('en-IN')}` : '-'}
                        </TableCell>
                        <TableCell className="text-foreground font-medium hidden lg:table-cell">
                          {student.start_date ? new Date(student.start_date).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell className="text-foreground font-medium">
                          {student.valid_date ? new Date(student.valid_date).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell>
                          <span className={cn(
                            "px-2.5 py-1 rounded-full text-xs font-semibold inline-block",
                            status.type === 'expired' && "bg-destructive/15 text-destructive border border-destructive/30",
                            status.type === 'warning' && "bg-orange-500/15 text-orange-500 border border-orange-500/30",
                            status.type === 'active' && "bg-primary/15 text-primary border border-primary/30"
                          )}>
                            {status.label}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditDialog(student)}
                              className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 h-8 px-2.5"
                            >
                              <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deleteStudent(student.id)}
                              className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-8 px-2.5"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {filteredStudents.length === 0 && (
              <CardContent className="py-12 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery ? 'No students match your search' : `No students found in ${selectedHostel}`}
                </p>
              </CardContent>
            )}
          </Card>

          {totalPages > 1 && (
            <div className="mt-4 flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="text-sm px-4">Page {currentPage} of {totalPages}</span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </motion.div>
      )}

      <EditStudentDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        editForm={editForm}
        setEditForm={setEditForm}
        editStartDate={editStartDate}
        setEditStartDate={setEditStartDate}
        editEndDate={editEndDate}
        setEditEndDate={setEditEndDate}
        onSubmit={handleEditSubmit}
        submitting={isSubmitting}
      />

      <CompleteRegistrationDialog
        open={!!registeringApplicant}
        onOpenChange={(open) => !open && setRegisteringApplicant(null)}
        applicant={registeringApplicant}
        onSuccess={() => {
          fetchPendingRegistrations();
          fetchStudents();
        }}
      />
    </div>
  );
}