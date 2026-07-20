import { InlineSkeletonList } from '@/components/ui/dashboard-skeleton';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useHostel } from '@/contexts/HostelContext';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { UserPlus, CalendarIcon, Eye, EyeOff, Home, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Room {
  id: string;
  room_number: string;
  capacity: number;
  occupied_count: number;
  status: 'available' | 'full';
}

function RegisterStudentContent() {
  const { user, isAdmin, loading } = useAuth();
  const { selectedHostel } = useHostel();
  const navigate = useNavigate();
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
  const [successMessage, setSuccessMessage] = useState('');

  // Auto-generate temp password when name or phone changes
  const generateTempPassword = (name: string, phone: string) => {
    const firstName = name.split(' ')[0] || 'User';
    const phonePart = phone.replace(/\D/g, '').slice(0, 6) || '123456';
    return `${firstName}@${phonePart}`;
  };

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate('/admin-login');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage('');

    if (!formData.username) {
      toast.error('User ID is required');
      return;
    }

    if (!startDate) {
      toast.error('Joining Date is required');
      return;
    }

    // Validate room if selected
    if (selectedRoomId && !validateRoom(selectedRoomId)) {
      toast.error(roomError || 'Selected room is not available');
      return;
    }

    // Normalize username - remove @ and everything after if present, then lowercase
    const normalizedUsername = formData.username.toLowerCase().split('@')[0].trim();

    if (!normalizedUsername) {
      toast.error('Please enter a valid User ID');
      return;
    }

    // Get selected room number
    const selectedRoom = rooms.find(r => r.id === selectedRoomId);
    const roomNumber = selectedRoom?.room_number || '';

    // Use formData.email for email
    const email = formData.email.toLowerCase().trim();

    setIsSubmitting(true);

    try {
      const response = await api.post('/students', {
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
      });

      if (response.data?.success) {
        setSuccessMessage('✅ Student registered successfully');
        setFormData({
          name: '',
          phone: '',
          parent_phone: '',
          fees: '',
          password: '',
          username: '',
        });
        setSelectedRoomId('');
        setStartDate(new Date());
        setEndDate(undefined);
        fetchRooms(); // Refresh rooms to get updated occupancy
      }
    } catch (error: any) {
      console.error('Error registering student:', error);
      toast.error(error.response?.data?.message || 'Failed to register student');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-8"><InlineSkeletonList rows={5} /></div>
    );
  }

  const availableRooms = rooms.filter(r => r.status === 'available');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-primary-foreground" />
            </div>
            Register New Student
            <span className="ml-auto text-sm font-normal text-primary">
              Hostel: {selectedHostel}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground">Full Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter student name"
                  required
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">Student Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="student@example.com"
                  required
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username" className="text-foreground">User ID (for login)</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Unique user ID (e.g. karan123)"
                  required
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-foreground">Phone Number</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => {
                    const newPhone = e.target.value;
                    setFormData({ 
                      ...formData, 
                      phone: newPhone,
                      password: generateTempPassword(formData.name, newPhone)
                    });
                  }}
                  placeholder="+91 XXXXXXXXXX"
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parent_phone" className="text-foreground">Parent's Mobile Number</Label>
                <Input
                  id="parent_phone"
                  value={formData.parent_phone}
                  onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })}
                  placeholder="Enter Parent's Mobile Number"
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="room_no" className="text-foreground flex items-center gap-2">
                  <Home className="w-4 h-4" />
                  Room Number
                </Label>
                <Select value={selectedRoomId} onValueChange={handleRoomChange}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Select a room" />
                  </SelectTrigger>
                  <SelectContent>
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
                {rooms.length === 0 && (
                  <p className="text-xs text-warning">
                    Please add rooms in Room Management before registering students.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="fees" className="text-foreground">Monthly Fees (₹)</Label>
                <Input
                  id="fees"
                  type="number"
                  value={formData.fees}
                  onChange={(e) => setFormData({ ...formData, fees: e.target.value })}
                  placeholder="e.g., 5000"
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Joining Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-secondary border-border",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
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
              <div className="space-y-2">
                <Label className="text-foreground">End Date <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-secondary border-border",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
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
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="password" className="text-foreground">Temporary Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    readOnly
                    placeholder="Auto-generated temporary password"
                    required
                    className="bg-secondary/50 border-border pr-10 cursor-not-allowed text-muted-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  This temporary password will be emailed to the student. They will be prompted to reset it.
                </p>
              </div>
            </div>

            <Button
              type="submit"
              variant="hero"
              className="w-full"
              disabled={isSubmitting || !!roomError}
            >
              {isSubmitting ? 'Registering...' : 'Register Student'}
            </Button>

            {successMessage && (
              <p className="text-sm text-primary font-medium">{successMessage}</p>
            )}
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default RegisterStudentContent;