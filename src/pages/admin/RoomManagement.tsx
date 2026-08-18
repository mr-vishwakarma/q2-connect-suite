import { useEffect, useState, useCallback } from 'react';
import { InlineSkeletonList } from '@/components/ui/dashboard-skeleton';
import { useHostel } from '@/contexts/HostelContext';
import { roomService, studentService } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { toast } from 'react-toastify';
import { Home, Users, Plus, Edit2, Trash2, UserPlus } from 'lucide-react';

interface Room {
  id: string;
  room_number: string;
  capacity: number;
  occupied_count: number;
  status: 'available' | 'full';
  students?: { id: string; name: string; username: string }[];
}

interface Student {
  id: string;
  name: string;
  username: string;
  room_no: string | null;
}

export default function RoomManagement() {
  const { selectedHostel } = useHostel();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [newRoom, setNewRoom] = useState({ room_number: '', capacity: 4 });
  const [editRoom, setEditRoom] = useState({ room_number: '', capacity: 4 });

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRooms, setTotalRooms] = useState(0);

  const fetchRooms = useCallback(async () => {
    try {
      const response = await roomService.getRooms({ hostel: selectedHostel });
      if (response.success && response.data) {
        const mapped = (response.data as any[]).map((r: any) => ({
          id: r._id || r.id,
          room_number: r.roomNumber,
          capacity: r.capacity,
          occupied_count: r.occupiedCount,
          status: r.status,
        }));
        setRooms(mapped);
      }
    } catch (err) {
      console.error('Error fetching rooms:', err);
      toast.error('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  }, [selectedHostel]);

  const fetchStudents = useCallback(async () => {
    try {
      const response = await studentService.getStudents({ hostel: selectedHostel, limit: 100 });
      if (response.success && response.data) {
        const studentList = Array.isArray(response.data) ? response.data : response.data.students || [];
        const mapped = studentList.map((s: any) => ({
          id: s._id || s.id,
          name: s.name,
          username: s.username,
          room_no: s.roomNo || s.room_no,
        }));
        setStudents(mapped);
      }
    } catch (err) {
      console.error('Error fetching students:', err);
    }
  }, [selectedHostel]);

  useEffect(() => {
    fetchRooms();
    fetchStudents();
  }, [fetchRooms, fetchStudents]);

  const handleAddRoom = async () => {
    if (!newRoom.room_number) {
      toast.error('Please enter room number');
      return;
    }

    try {
      await api.post('/rooms', {
        roomNumber: newRoom.room_number,
        capacity: newRoom.capacity,
        hostel: selectedHostel,
      });

      toast.success('Room added successfully');
      setShowAddDialog(false);
      setNewRoom({ room_number: '', capacity: 4 });
      fetchRooms();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add room');
    }
  };

  const handleEditRoom = async () => {
    if (!selectedRoom || !editRoom.room_number) return;

    try {
      await api.put(`/rooms/${selectedRoom.id}`, {
        roomNumber: editRoom.room_number,
        capacity: editRoom.capacity,
      });

      toast.success('Room updated successfully');
      setShowEditDialog(false);
      fetchRooms();
    } catch (error) {
      toast.error('Failed to update room');
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm('Are you sure you want to delete this room?')) return;

    try {
      await api.delete(`/rooms/${roomId}`);
      toast.success('Room deleted successfully');
      fetchRooms();
    } catch (error) {
      toast.error('Failed to delete room');
    }
  };

  const handleAssignStudent = async () => {
    if (!selectedRoom || !selectedStudent) return;

    try {
      await api.put(`/students/${selectedStudent}`, { 
        roomNo: selectedRoom.room_number,
        hostel: selectedHostel
      });

      toast.success('Student assigned to room');
      setShowAssignDialog(false);
      setSelectedStudent('');
      fetchStudents();
      fetchRooms();
    } catch (error) {
      toast.error('Failed to assign student');
    }
  };

  const unassignedStudents = students.filter(s => !s.room_no);
  const availableRooms = rooms.filter(r => r.status === 'available');
  const totalCapacity = rooms.reduce((sum, r) => sum + r.capacity, 0);
  const totalOccupied = rooms.reduce((sum, r) => sum + r.occupied_count, 0);

  return (
    <div className="space-y-6 animate-fade-in">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-3 rounded-xl bg-primary/10 shrink-0">
                  <Home className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Total Rooms</p>
                  <p className="text-lg sm:text-2xl font-bold text-foreground">{rooms.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-3 rounded-xl bg-success/10 shrink-0">
                  <Home className="w-5 h-5 sm:w-6 sm:h-6 text-success" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Available</p>
                  <p className="text-lg sm:text-2xl font-bold text-foreground">{availableRooms.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-3 rounded-xl bg-warning/10 shrink-0">
                  <Users className="w-5 h-5 sm:w-6 sm:h-6 text-warning" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Occupancy</p>
                  <p className="text-lg sm:text-2xl font-bold text-foreground">{totalOccupied}/{totalCapacity}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-3 rounded-xl bg-destructive/10 shrink-0">
                  <UserPlus className="w-5 h-5 sm:w-6 sm:h-6 text-destructive" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Unassigned</p>
                  <p className="text-lg sm:text-2xl font-bold text-foreground">{unassignedStudents.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Room
          </Button>
        </div>

        {/* Rooms Table */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Room List</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8">
                <InlineSkeletonList rows={5} />
              </div>
            ) : rooms.length === 0 ? (
              <div className="text-center py-8">
                <Home className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-3">No rooms registered in {selectedHostel}.</p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Room in {selectedHostel}
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-secondary/50">
                      <TableHead className="text-foreground font-bold">Room Number</TableHead>
                      <TableHead className="text-foreground font-bold">Capacity</TableHead>
                      <TableHead className="text-foreground font-bold">Occupied</TableHead>
                      <TableHead className="text-foreground font-bold">Status</TableHead>
                      <TableHead className="text-foreground font-bold">Students</TableHead>
                      <TableHead className="text-foreground font-bold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rooms.map((room) => {
                      const roomStudents = students.filter(s => s.room_no === room.room_number);
                      return (
                        <TableRow key={room.id}>
                          <TableCell className="font-semibold text-foreground">{room.room_number}</TableCell>
                          <TableCell className="text-foreground font-medium">{room.capacity}</TableCell>
                          <TableCell className="text-foreground font-medium">{room.occupied_count}</TableCell>
                          <TableCell>
                            <Badge variant={room.status === 'available' ? 'default' : 'outline'} className={room.status === 'full' ? 'bg-green-500/20 text-green-500 border-green-500/30' : ''}>
                              {room.status === 'full' ? 'Full' : 'Available'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {roomStudents.map(s => (
                                <Badge key={s.id} variant="secondary" className="text-xs">
                                  {s.name}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {room.status === 'available' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedRoom(room);
                                    setShowAssignDialog(true);
                                  }}
                                >
                                  <UserPlus className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedRoom(room);
                                  setEditRoom({ room_number: room.room_number, capacity: room.capacity });
                                  setShowEditDialog(true);
                                }}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteRoom(room.id)}
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
            )}
          </CardContent>
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

      {/* Add Room Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Room</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Room Number</Label>
              <Input
                value={newRoom.room_number}
                onChange={(e) => setNewRoom({ ...newRoom, room_number: e.target.value })}
                placeholder="e.g., 101"
              />
            </div>
            <div>
              <Label>Capacity</Label>
              <Input
                type="number"
                value={newRoom.capacity}
                onChange={(e) => setNewRoom({ ...newRoom, capacity: parseInt(e.target.value) || 1 })}
                min={1}
              />
            </div>
            <Button className="w-full" onClick={handleAddRoom}>
              Add Room
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Room Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Room</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Room Number</Label>
              <Input
                value={editRoom.room_number}
                onChange={(e) => setEditRoom({ ...editRoom, room_number: e.target.value })}
              />
            </div>
            <div>
              <Label>Capacity</Label>
              <Input
                type="number"
                value={editRoom.capacity}
                onChange={(e) => setEditRoom({ ...editRoom, capacity: parseInt(e.target.value) || 1 })}
                min={1}
              />
            </div>
            <Button className="w-full" onClick={handleEditRoom}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Student Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Student to Room {selectedRoom?.room_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {unassignedStudents.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                All students are already assigned to rooms
              </p>
            ) : (
              <>
                <div>
                  <Label>Select Student</Label>
                  <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a student" />
                    </SelectTrigger>
                    <SelectContent>
                      {unassignedStudents.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.name} ({student.username})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={handleAssignStudent} disabled={!selectedStudent}>
                  Assign to Room
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
