import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  XCircle,
  Sparkles,
  Sun,
  Sunset,
  Moon,
  AlertCircle,
  Loader2,
  Trash2,
  Zap,
} from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, addDays, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'react-toastify';
import { api } from '@/lib/api';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';

interface Booking {
  _id: string;
  timeSlot: string;
  machineNumber: number;
  status: string;
  student?: {
    _id: string;
    name?: string;
    roomNo?: string;
  };
}

interface LaundryData {
  totalMachines: number;
  operatingHours: string[];
  hostel?: string;
  bookings: Booking[];
}

type PeriodFilter = 'all' | 'morning' | 'afternoon' | 'evening';

// Helper to convert 24hr slot "06:00-07:00" to friendly 12hr "6:00 AM – 7:00 AM"
function formatSlotTo12Hour(slot: string): { start: string; end: string; full: string } {
  const [start24, end24] = slot.split('-');
  const to12 = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${m < 10 ? '0' : ''}${m} ${ampm}`;
  };
  const start = to12(start24);
  const end = to12(end24);
  return { start, end, full: `${start} – ${end}` };
}

// Classify slot by time of day
function getSlotPeriod(slot: string): 'morning' | 'afternoon' | 'evening' {
  const hour = parseInt(slot.split(':')[0], 10);
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

export default function Laundry() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = addDays(today, 1);

  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [data, setData] = useState<LaundryData | null>(null);
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');

  const fetchSlots = async (dateToFetch: Date) => {
    try {
      setLoading(true);
      const dateStr = format(dateToFetch, 'yyyy-MM-dd');
      const response = await api.get(`/laundry/slots?date=${dateStr}`);
      if (response.data?.success) {
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
      if (response.data?.success) {
        setMyBookings(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch my bookings', error);
    }
  };

  useEffect(() => {
    fetchSlots(selectedDate);
    fetchMyBookings();
    setSelectedSlot(null); // Reset selection on date change
  }, [selectedDate]);

  const handleBook = async () => {
    if (!selectedSlot) {
      toast.info('Please click a time slot to select it first');
      return;
    }

    try {
      setBookingInProgress(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const response = await api.post('/laundry/book', {
        date: dateStr,
        timeSlot: selectedSlot,
        machineNumber: 1,
      });

      if (response.data?.success) {
        toast.success(`🎉 Washing Machine #1 booked for ${formatSlotTo12Hour(selectedSlot).full}!`);
        setSelectedSlot(null);
        fetchSlots(selectedDate);
        fetchMyBookings();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to book slot');
    } finally {
      setBookingInProgress(false);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!window.confirm('Are you sure you want to cancel this laundry booking?')) return;
    try {
      const res = await api.delete(`/laundry/cancel/${bookingId}`);
      if (res.data?.success) {
        toast.success('Booking cancelled successfully');
        fetchSlots(selectedDate);
        fetchMyBookings();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to cancel booking');
    }
  };

  const isSlotBooked = (timeSlot: string) => {
    return data?.bookings.some(
      (b) => b.timeSlot === timeSlot && b.status === 'booked'
    );
  };

  const isSlotMaintenance = (timeSlot: string) => {
    return data?.bookings.some(
      (b) => b.timeSlot === timeSlot && b.status === 'maintenance'
    );
  };

  // Filter slots according to period tab
  const filteredOperatingHours = (data?.operatingHours || []).filter((slot) => {
    if (periodFilter === 'all') return true;
    return getSlotPeriod(slot) === periodFilter;
  });

  const bookedCountToday = (data?.bookings || []).filter(b => b.status === 'booked').length;
  const availableCountToday = Math.max(0, (data?.operatingHours || []).length - bookedCountToday);

  return (
    <DashboardLayout title="Laundry Queue">
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header with Live Status & Date Selector */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Laundry Machine Queue</h1>
                <p className="text-xs text-muted-foreground">
                  Single Washing Machine system · Reserve your 1-hour wash cycle slot
                </p>
              </div>
            </div>
          </div>

          {/* Quick Date Tabs: Today / Tomorrow / Custom */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant={isSameDay(selectedDate, today) ? 'default' : 'outline'}
              onClick={() => setSelectedDate(today)}
              className="text-xs font-semibold h-8 rounded-lg"
            >
              Today ({format(today, 'EEE d')})
            </Button>
            <Button
              size="sm"
              variant={isSameDay(selectedDate, tomorrow) ? 'default' : 'outline'}
              onClick={() => setSelectedDate(tomorrow)}
              className="text-xs font-semibold h-8 rounded-lg"
            >
              Tomorrow ({format(tomorrow, 'EEE d')})
            </Button>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "text-xs font-normal h-8 rounded-lg gap-1.5",
                    !isSameDay(selectedDate, today) && !isSameDay(selectedDate, tomorrow) && "border-primary text-primary"
                  )}
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  <span>{format(selectedDate, 'MMM d, yyyy')}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                  disabled={(d) => {
                    const compToday = new Date();
                    compToday.setHours(0, 0, 0, 0);
                    const compTomorrow = addDays(compToday, 1);
                    return d < compToday || d > compTomorrow;
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Machine Status Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="bg-card border-border/80 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase">Machine #1 Status</div>
                <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Operational & Ready
                </div>
              </div>
            </div>
            <Badge variant="outline" className="text-[11px] border-emerald-500/30 text-emerald-400">
              Hostel {data?.hostel || 'Q2'}
            </Badge>
          </Card>

          <Card className="bg-card border-border/80 p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase">Available Slots Today</div>
              <div className="text-xl font-black text-foreground mt-0.5">
                {availableCountToday} <span className="text-xs font-normal text-muted-foreground">/ 16 slots</span>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs">
              {bookedCountToday} Booked
            </Badge>
          </Card>

          <Card className="bg-card border-border/80 p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase">Daily Resident Limit</div>
              <div className="text-sm font-bold text-foreground mt-0.5">1 Slot / Day</div>
              <p className="text-[10px] text-muted-foreground">Fair sharing for all hostel residents</p>
            </div>
            <Sparkles className="w-5 h-5 text-amber-500 opacity-80" />
          </Card>
        </div>

        {/* Main Grid: Slot Selection & Active Bookings */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Slot Selection By Clock/Time */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3 border-b border-border/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary" />
                      Select Slot by Clock Time
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {format(selectedDate, 'EEEE, MMMM dd, yyyy')} · Tap any available time slot below
                    </CardDescription>
                  </div>

                  {/* Period Filter Tabs */}
                  <div className="flex items-center gap-1 bg-secondary/60 p-1 rounded-xl border border-border/60">
                    <button
                      type="button"
                      onClick={() => setPeriodFilter('all')}
                      className={cn(
                        "px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all",
                        periodFilter === 'all'
                          ? "bg-card text-foreground shadow-sm font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      All Day
                    </button>
                    <button
                      type="button"
                      onClick={() => setPeriodFilter('morning')}
                      className={cn(
                        "px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all flex items-center gap-1",
                        periodFilter === 'morning'
                          ? "bg-card text-foreground shadow-sm font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Sun className="w-3 h-3 text-amber-400" />
                      <span>Morning</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPeriodFilter('afternoon')}
                      className={cn(
                        "px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all flex items-center gap-1",
                        periodFilter === 'afternoon'
                          ? "bg-card text-foreground shadow-sm font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Sunset className="w-3 h-3 text-orange-400" />
                      <span>Afternoon</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPeriodFilter('evening')}
                      className={cn(
                        "px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all flex items-center gap-1",
                        periodFilter === 'evening'
                          ? "bg-card text-foreground shadow-sm font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Moon className="w-3 h-3 text-indigo-400" />
                      <span>Evening</span>
                    </button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4">
                {loading ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground">Loading slots for Machine #1...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                    {filteredOperatingHours.map((slot) => {
                      const formatted = formatSlotTo12Hour(slot);
                      const booked = isSlotBooked(slot);
                      const maintenance = isSlotMaintenance(slot);
                      const isSelected = selectedSlot === slot;

                      return (
                        <motion.button
                          key={slot}
                          type="button"
                          whileTap={!booked && !maintenance ? { scale: 0.97 } : {}}
                          disabled={booked || maintenance}
                          onClick={() => setSelectedSlot(slot)}
                          className={cn(
                            "relative p-3 rounded-xl border text-left transition-all flex flex-col justify-between min-h-[84px]",
                            isSelected && "border-primary bg-primary/10 shadow-md ring-2 ring-primary/20",
                            !isSelected && !booked && !maintenance && "border-border/80 bg-secondary/30 hover:border-primary/50 hover:bg-secondary/60 cursor-pointer",
                            booked && "border-border/40 bg-muted/30 opacity-60 cursor-not-allowed",
                            maintenance && "border-amber-500/30 bg-amber-500/5 opacity-70 cursor-not-allowed"
                          )}
                        >
                          <div className="flex items-center justify-between w-full mb-1">
                            <span className="text-[11px] font-mono text-muted-foreground">
                              {slot}
                            </span>
                            {isSelected ? (
                              <CheckCircle2 className="w-4 h-4 text-primary" />
                            ) : booked ? (
                              <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
                            ) : maintenance ? (
                              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                            ) : (
                              <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            )}
                          </div>

                          <div>
                            <div className="font-bold text-xs text-foreground">
                              {formatted.start}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              until {formatted.end}
                            </div>
                          </div>

                          <div className="mt-1">
                            {booked ? (
                              <span className="text-[10px] font-semibold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                                Booked
                              </span>
                            ) : maintenance ? (
                              <span className="text-[10px] font-semibold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                Servicing
                              </span>
                            ) : isSelected ? (
                              <span className="text-[10px] font-bold text-primary bg-primary/20 px-1.5 py-0.5 rounded">
                                Selected
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                Available
                              </span>
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                {/* Selected Slot Booking Call-to-Action */}
                <AnimatePresence>
                  {selectedSlot && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="mt-4 p-4 rounded-xl bg-gradient-to-r from-primary/10 via-card to-primary/5 border border-primary/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg"
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold text-primary flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" /> Ready to Confirm Washing Slot
                        </div>
                        <div className="text-sm font-bold text-foreground">
                          Machine #1 · {formatSlotTo12Hour(selectedSlot).full} ({format(selectedDate, 'EEE, MMM d')})
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedSlot(null)}
                          className="text-xs h-8"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          disabled={bookingInProgress}
                          onClick={handleBook}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-8 px-4 gap-1.5 shadow-md"
                        >
                          {bookingInProgress ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Reserving...</span>
                            </>
                          ) : (
                            <>
                              <Zap className="w-3.5 h-3.5" />
                              <span>Confirm Booking</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>

          {/* Right Col: My Bookings & Queue Rules */}
          <div className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-foreground flex items-center justify-between">
                  <span>My Laundry Bookings</span>
                  <Badge variant="outline" className="text-[11px] font-mono">
                    {myBookings.length}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">Your upcoming and past wash reservations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {myBookings.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    <Clock className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p>No wash slots booked yet.</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Select an available time slot to reserve Machine #1.</p>
                  </div>
                ) : (
                  myBookings.map((b) => {
                    const formatted = formatSlotTo12Hour(b.timeSlot);
                    const isUpcoming = b.status === 'booked';
                    return (
                      <div
                        key={b._id}
                        className={cn(
                          "p-3 rounded-xl border transition-all text-xs",
                          isUpcoming
                            ? "bg-card border-primary/30 shadow-sm"
                            : "bg-secondary/30 border-border/50 opacity-70"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-foreground">
                            {format(new Date(b.date), 'EEE, MMM d, yyyy')}
                          </span>
                          {b.status === 'booked' ? (
                            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px]">
                              Upcoming
                            </Badge>
                          ) : b.status === 'cancelled' ? (
                            <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px]">
                              Cancelled
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">
                              Completed
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-muted-foreground">
                          <span className="font-mono text-foreground font-semibold">
                            {formatted.full}
                          </span>
                          <span>Machine #{b.machineNumber || 1}</span>
                        </div>

                        {isUpcoming && (
                          <div className="mt-2.5 pt-2 border-t border-border/60 flex justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelBooking(b._id)}
                              className="text-[11px] text-destructive hover:bg-destructive/10 h-7 px-2 gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Cancel Slot</span>
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* Fair Queue Policy */}
            <Card className="bg-secondary/30 border-border/60 p-4 space-y-2">
              <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Single Machine Rules
              </h3>
              <ul className="text-[11px] text-muted-foreground space-y-1.5 list-disc pl-4">
                <li>Limit: <strong>1 slot per student per day</strong> to ensure fair access for everyone.</li>
                <li>Slots can be booked for <strong>Today or Tomorrow</strong> only.</li>
                <li>Please empty the washing machine promptly within <strong>10 minutes</strong> of cycle completion.</li>
                <li>Only use recommended detergent to prevent machine foam blockages.</li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
