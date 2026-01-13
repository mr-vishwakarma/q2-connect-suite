import { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useHostel } from '@/contexts/HostelContext';
import { supabase } from '@/integrations/supabase/client';
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
import { toast } from 'sonner';
import { Home, Users, Plus, Edit2, Trash2, UserPlus } from 'lucide-react';

interface Room {
  id: string;
  room_number: string;
  capacity: number;
  occupied_count: number;
  status: 'available' | 'full';
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

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('hostel', selectedHostel)
      .order('room_number');

    if (error) {
      console.error('Error fetching rooms:', error);
    } else {
      setRooms(data || []);
    }
    setLoading(false);
  }, [selectedHostel]);

  const fetchStudents = useCallback(async () => {
    const { data } = await supabase
      .from('students')
      .select('id, name, username, room_no')
      .eq('hostel', selectedHostel);

    if (data) {
      setStudents(data);
    }
  }, [selectedHostel]);

  // Update room occupancy counts based on students
  const updateRoomOccupancy = useCallback(async () => {
    for (const room of rooms) {
      const studentsInRoom = students.filter(s => s.room_no === room.room_number).length;
      if (studentsInRoom !== room.occupied_count) {
        const newStatus = studentsInRoom >= room.capacity ? 'full' : 'available';
        await supabase
          .from('rooms')
          .update({ 
            occupied_count: studentsInRoom,
            status: newStatus
          })
          .eq('id', room.id);
      }
    }
    fetchRooms();
  }, [rooms, students, fetchRooms]);

  useEffect(() => {
    fetchRooms();
    fetchStudents();
  }, [fetchRooms, fetchStudents]);

  useEffect(() => {
    if (rooms.length > 0 && students.length > 0) {
      updateRoomOccupancy();
    }
  }, [students]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`rooms-${selectedHostel}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `hostel=eq.${selectedHostel}`,
        },
        () => fetchRooms()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedHostel, fetchRooms]);

  const handleAddRoom = async () => {
    if (!newRoom.room_number) {
      toast.error('Please enter room number');
      return;
    }

    const { error } = await supabase.from('rooms').insert({
      room_number: newRoom.room_number,
      capacity: newRoom.capacity,
      hostel: selectedHostel,
    });

    if (error) {
      if (error.code === '23505') {
        toast.error('Room number already exists');
      } else {
        toast.error('Failed to add room');
      }
    } else {
      toast.success('Room added successfully');
      setShowAddDialog(false);
      setNewRoom({ room_number: '', capacity: 4 });
      fetchRooms();
    }
  };

  const handleEditRoom = async () => {
    if (!selectedRoom || !editRoom.room_number) return;

    const { error } = await supabase
      .from('rooms')
      .update({
        room_number: editRoom.room_number,
        capacity: editRoom.capacity,
      })
      .eq('id', selectedRoom.id);

    if (error) {
      toast.error('Failed to update room');
    } else {
      toast.success('Room updated successfully');
      setShowEditDialog(false);
      fetchRooms();
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm('Are you sure you want to delete this room?')) return;

    const { error } = await supabase.from('rooms').delete().eq('id', roomId);

    if (error) {
      toast.error('Failed to delete room');
    } else {
      toast.success('Room deleted successfully');
      fetchRooms();
    }
  };

  const handleAssignStudent = async () => {
    if (!selectedRoom || !selectedStudent) return;

    const { error } = await supabase
      .from('students')
      .update({ room_no: selectedRoom.room_number })
      .eq('id', selectedStudent);

    if (error) {
      toast.error('Failed to assign student');
    } else {
      toast.success('Student assigned to room');
      setShowAssignDialog(false);
      setSelectedStudent('');
      fetchStudents();
    }
  };

  const unassignedStudents = students.filter(s => !s.room_no);
  const availableRooms = rooms.filter(r => r.status === 'available');
  const totalCapacity = rooms.reduce((sum, r) => sum + r.capacity, 0);
  const totalOccupied = rooms.reduce((sum, r) => sum + r.occupied_count, 0);

  return (
    <AdminLayout title="Room Management">
      <div className="space-y-6 animate-fade-in">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Home className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Rooms</p>
                  <p className="text-2xl font-bold text-foreground">{rooms.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-success/10">
                  <Home className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Available</p>
                  <p className="text-2xl font-bold text-foreground">{availableRooms.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-warning/10">
                  <Users className="w-6 h-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Occupancy</p>
                  <p className="text-2xl font-bold text-foreground">{totalOccupied}/{totalCapacity}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-destructive/10">
                  <UserPlus className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Unassigned</p>
                  <p className="text-2xl font-bold text-foreground">{unassignedStudents.length}</p>
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
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : rooms.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No rooms found. Add your first room.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Room Number</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Occupied</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Students</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rooms.map((room) => {
                      const roomStudents = students.filter(s => s.room_no === room.room_number);
                      return (
                        <TableRow key={room.id}>
                          <TableCell className="font-medium">{room.room_number}</TableCell>
                          <TableCell>{room.capacity}</TableCell>
                          <TableCell>{room.occupied_count}</TableCell>
                          <TableCell>
                            <Badge variant={room.status === 'available' ? 'default' : 'destructive'}>
                              {room.status}
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
      </div>

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
    </AdminLayout>
  );
}
