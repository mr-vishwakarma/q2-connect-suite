import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Calendar as CalendarIcon,
  Trash2,
  Search,
  Shirt,
  Clock,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Zap,
} from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'react-toastify';
import { api } from '@/lib/api';
import { useHostel } from '@/contexts/HostelContext';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Booking {
  _id: string;
  timeSlot: string;
  machineNumber: number;
  status: string;
  notes?: string;
  student?: {
    _id: string;
    name?: string;
    roomNo?: string;
    phone?: string;
    email?: string;
  };
}

function formatSlotTo12Hour(slot: string): string {
  const [start24, end24] = slot.split('-');
  const to12 = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${m < 10 ? '0' : ''}${m} ${ampm}`;
  };
  return `${to12(start24)} – ${to12(end24)}`;
}

export default function LaundryManagement() {
  const { selectedHostel } = useHostel();
  const [date, setDate] = useState<Date>(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [operatingHours, setOperatingHours] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [blockingSlot, setBlockingSlot] = useState<string | null>(null);

  const fetchBookings = async (selectedDate: Date) => {
    try {
      setLoading(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const response = await api.get('/laundry/slots', {
        params: {
          date: dateStr,
          hostel: selectedHostel,
        },
      });
      if (response.data.success) {
        setBookings(response.data.data.bookings || []);
        setOperatingHours(response.data.data.operatingHours || []);
      }
    } catch (error: any) {
      toast.error('Failed to fetch laundry bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings(date);
  }, [date, selectedHostel]);

  const handleCancelBooking = async (id: string, studentName?: string) => {
    if (!window.confirm(`Are you sure you want to cancel the wash booking for ${studentName || 'this student'}?`)) return;
    try {
      const response = await api.delete(`/laundry/cancel/${id}`);
      if (response.data.success) {
        toast.success('Booking cancelled successfully');
        fetchBookings(date);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to cancel booking');
    }
  };

  const handleToggleMaintenance = async (timeSlot: string) => {
    try {
      setBlockingSlot(timeSlot);
      const dateStr = format(date, 'yyyy-MM-dd');
      const res = await api.post('/laundry/admin/block', {
        date: dateStr,
        timeSlot,
        hostel: selectedHostel,
        notes: 'Machine Servicing',
      });
      if (res.data?.success) {
        toast.success(res.data.message || 'Maintenance slot updated');
        fetchBookings(date);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to toggle maintenance');
    } finally {
      setBlockingSlot(null);
    }
  };

  const filteredBookings = bookings.filter((b) => {
    const s = searchTerm.toLowerCase();
    const name = b.student?.name?.toLowerCase() || '';
    const room = b.student?.roomNo?.toLowerCase() || '';
    const slot = b.timeSlot.toLowerCase();
    return name.includes(s) || room.includes(s) || slot.includes(s);
  });

  const bookedSlotsCount = bookings.filter(b => b.status === 'booked').length;
  const maintenanceCount = bookings.filter(b => b.status === 'maintenance').length;
  const availableCount = Math.max(0, (operatingHours.length || 16) - bookings.length);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2.5">
            <Shirt className="w-8 h-8 text-primary" />
            Laundry Management (Machine #1)
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Single Washing Machine queue & maintenance scheduling for <strong>{selectedHostel}</strong>
          </p>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[240px] justify-start text-left font-normal bg-card",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "PPP") : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(newDate) => newDate && setDate(newDate)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4 border-border/80 bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase font-semibold">Active Machine</span>
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-foreground mt-1">Washing Machine #1</div>
          <p className="text-[11px] text-emerald-400 mt-0.5">Online & Scheduled</p>
        </Card>

        <Card className="p-4 border-border/80 bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase font-semibold">Booked Today</span>
            <CheckCircle2 className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-foreground mt-1">{bookedSlotsCount}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Resident wash cycles</p>
        </Card>

        <Card className="p-4 border-border/80 bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase font-semibold">Available Slots</span>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-1">{availableCount}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Slots open for booking</p>
        </Card>

        <Card className="p-4 border-border/80 bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase font-semibold">Maintenance</span>
            <Wrench className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 mt-1">{maintenanceCount}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Servicing holds</p>
        </Card>
      </div>

      {/* Bookings Table */}
      <Card className="border-border">
        <CardHeader className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-3 border-b border-border/60">
          <div>
            <CardTitle className="text-base font-bold">
              Machine #1 Schedule — {format(date, "MMMM dd, yyyy")}
            </CardTitle>
            <CardDescription className="text-xs">
              Monitor active bookings, resident details, or reserve maintenance blocks
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Filter by student, room, or slot..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-xs h-9 bg-secondary/50"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-12">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs space-y-1">
              <Clock className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="font-semibold text-foreground">No bookings recorded for this date.</p>
              <p>Machine #1 is free all day for resident reservations.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-xs text-muted-foreground">Time Slot</TableHead>
                    <TableHead className="text-xs text-muted-foreground">12-Hour Clock</TableHead>
                    <TableHead className="text-xs text-muted-foreground">Machine</TableHead>
                    <TableHead className="text-xs text-muted-foreground">Student Name</TableHead>
                    <TableHead className="text-xs text-muted-foreground">Room No</TableHead>
                    <TableHead className="text-xs text-muted-foreground">Phone</TableHead>
                    <TableHead className="text-xs text-muted-foreground">Status</TableHead>
                    <TableHead className="text-xs text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.map((booking) => (
                    <TableRow key={booking._id} className="border-border hover:bg-secondary/30 text-xs">
                      <TableCell className="font-mono font-semibold text-foreground">
                        {booking.timeSlot}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-medium">
                        {formatSlotTo12Hour(booking.timeSlot)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          Machine #{booking.machineNumber || 1}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">
                        {booking.status === 'maintenance' ? (
                          <span className="text-amber-500 font-medium flex items-center gap-1">
                            <Wrench className="w-3 h-3" /> Machine Servicing
                          </span>
                        ) : (
                          booking.student?.name || 'Resident'
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {booking.student?.roomNo ? `Room ${booking.student.roomNo}` : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono">
                        {booking.student?.phone || '-'}
                      </TableCell>
                      <TableCell>
                        {booking.status === 'booked' ? (
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold rounded-full">
                            Booked
                          </span>
                        ) : booking.status === 'maintenance' ? (
                          <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/30 text-[10px] font-semibold rounded-full">
                            Maintenance
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-muted text-muted-foreground text-[10px] rounded-full capitalize">
                            {booking.status}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {booking.status === 'maintenance' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={blockingSlot === booking.timeSlot}
                            onClick={() => handleToggleMaintenance(booking.timeSlot)}
                            className="text-[11px] h-7 px-2 border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
                          >
                            Unblock
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2 gap-1 text-[11px]"
                            onClick={() => handleCancelBooking(booking._id, booking.student?.name)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Cancel</span>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
