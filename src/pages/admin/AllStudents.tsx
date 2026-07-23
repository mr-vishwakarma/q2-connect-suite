import { InlineSkeletonList } from '@/components/ui/dashboard-skeleton';
import { useCallback, useEffect, useState } from 'react';
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
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Users, Search, Trash2, Pencil, CalendarIcon } from 'lucide-react';
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
  const [isLoading, setIsLoading] = useState(true);
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

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate('/admin-login');
    }
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchStudents();
    }
  }, [user, isAdmin, selectedHostel]);

  const fetchStudents = useCallback(async () => {
    try {
      setIsLoading(prev => prev);
      const response = await api.get('/students', { params: { hostel: selectedHostel } });
      if (response.data?.success) {
        const mapped = response.data.data.map((s: any) => ({
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
      }
    } catch (error) {
      console.error('Error fetching students:', error);
      toast.error('Failed to fetch students');
    } finally {
      setIsLoading(false);
    }
  }, [selectedHostel]);

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
      await api.delete(`/students/${studentId}`);
      toast.success('Student deleted successfully');
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
      fetchStudents();
    } catch (error) {
      console.error('Error deleting student:', error);
      toast.error('Failed to delete student');
    }
  };

  const filteredStudents = students.filter(
    (student) =>
      student.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.room_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
                        {status.type === 'expired' && (
                          <span className="text-[#FF4D4F] font-bold">{status.label}</span>
                        )}
                        {status.type === 'warning' && (
                          <span className="text-[#FACC15] font-bold">{status.label}</span>
                        )}
                        {status.type === 'active' && (
                          <span className="text-[#22C55E] font-bold">{status.label}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditDialog(student)}
                            className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteStudent(student.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-4 h-4" />
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
      </motion.div>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit Student</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-foreground">Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-username" className="text-foreground">User ID</Label>
              <Input
                id="edit-username"
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                required
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-room" className="text-foreground">Room Number</Label>
              <Input
                id="edit-room"
                value={editForm.room_no}
                onChange={(e) => setEditForm({ ...editForm, room_no: e.target.value })}
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-fees" className="text-foreground">Monthly Fees</Label>
              <Input
                id="edit-fees"
                type="number"
                value={editForm.fees}
                onChange={(e) => setEditForm({ ...editForm, fees: e.target.value })}
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-secondary border-border",
                      !editStartDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editStartDate ? format(editStartDate, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={editStartDate}
                    onSelect={setEditStartDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-secondary border-border",
                      !editEndDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editEndDate ? format(editEndDate, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={editEndDate}
                    onSelect={setEditEndDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Button type="submit" variant="hero" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}