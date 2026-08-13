import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'react-toastify';
import { api } from '@/lib/api';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';

interface Booking {
  _id: string;
  timeSlot: string;
  machineNumber: number;
  status: string;
}

interface LaundryData {
  totalMachines: number;
  operatingHours: string[];
  bookings: Booking[];
}

export default function Laundry() {
  const [date, setDate] = useState<Date>(new Date());
  const [data, setData] = useState<LaundryData | null>(null);
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSlots = async (selectedDate: Date) => {
    try {
      setLoading(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const response = await api.get(`/laundry/slots?date=${dateStr}`);
      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load laundry slots');
    } finally {
      setLoading(false);
    }
  };

  const fetchMyBookings = async () => {
    try {
      const response = await api.get('/laundry/my-bookings');
      if (response.data.success) {
        setMyBookings(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch my bookings', error);
    }
  };

  useEffect(() => {
    fetchSlots(date);
    fetchMyBookings();
  }, [date]);

  const handleBook = async (timeSlot: string, machineNumber: number) => {
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const response = await api.post('/laundry/book', {
        date: dateStr,
        timeSlot,
        machineNumber
      });
      if (response.data.success) {
        toast.success('Laundry slot booked successfully!');
        fetchSlots(date);
        fetchMyBookings();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to book slot');
    }
  };

  const isSlotBooked = (timeSlot: string, machineNumber: number) => {
    return data?.bookings.some(
      (b) => b.timeSlot === timeSlot && b.machineNumber === machineNumber && b.status === 'booked'
    );
  };

  return (
    <DashboardLayout title="Laundry Room">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Laundry Room</h1>
            <p className="text-muted-foreground mt-1">Book a washing machine slot for your laundry</p>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-[240px] justify-start text-left font-normal",
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
                disabled={(date) => {
                  // Can only book today or tomorrow
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const tomorrow = addDays(today, 1);
                  return date < today || date > tomorrow;
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Available Slots - {format(date, "MMM dd, yyyy")}</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center p-8">
                    <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="min-w-[600px]">
                      <div className="grid grid-cols-5 gap-4 mb-4">
                        <div className="font-semibold text-muted-foreground text-sm">Time Slot</div>
                        {[...Array(data?.totalMachines || 0)].map((_, i) => (
                          <div key={i} className="font-semibold text-center text-sm">
                            Machine {i + 1}
                          </div>
                        ))}
                      </div>

                      <div className="space-y-3">
                        {data?.operatingHours.map((slot) => (
                          <div key={slot} className="grid grid-cols-5 gap-4 items-center p-2 rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="text-sm font-medium flex items-center gap-2">
                              <Clock className="w-4 h-4 text-primary" />
                              {slot}
                            </div>
                            {[...Array(data?.totalMachines || 0)].map((_, i) => {
                              const machineNum = i + 1;
                              const booked = isSlotBooked(slot, machineNum);
                              return (
                                <Button
                                  key={machineNum}
                                  variant={booked ? "secondary" : "outline"}
                                  size="sm"
                                  disabled={booked}
                                  onClick={() => handleBook(slot, machineNum)}
                                  className={cn(
                                    "w-full",
                                    booked ? "opacity-50 cursor-not-allowed bg-muted" : "hover:bg-primary hover:text-primary-foreground border-primary/50 text-primary"
                                  )}
                                >
                                  {booked ? 'Booked' : 'Book'}
                                </Button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>My Bookings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {myBookings.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No recent bookings found.</p>
                  ) : (
                    myBookings.map((booking: any) => (
                      <div key={booking._id} className="flex flex-col p-3 rounded-lg border border-border bg-card">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-semibold text-sm">{booking.date}</span>
                          {booking.status === 'booked' ? (
                            <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Upcoming
                            </span>
                          ) : booking.status === 'cancelled' ? (
                            <span className="text-xs px-2 py-1 bg-destructive/10 text-destructive rounded-full flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> Cancelled
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Completed
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span><Clock className="w-3 h-3 inline mr-1" /> {booking.timeSlot}</span>
                          <span>Machine {booking.machineNumber}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <h3 className="font-semibold text-primary mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Laundry Rules
                </h3>
                <ul className="text-sm space-y-2 text-muted-foreground list-disc pl-4">
                  <li>You can only book 1 slot per day.</li>
                  <li>Slots can be booked for today or tomorrow only.</li>
                  <li>Please empty the machine immediately after your slot ends.</li>
                  <li>Maintain cleanliness in the laundry room.</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
