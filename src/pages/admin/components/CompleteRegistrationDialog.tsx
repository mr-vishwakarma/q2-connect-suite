import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarIcon, Eye, EyeOff, UserPlus, Home, Phone, Mail, ExternalLink, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { toast } from 'react-toastify';

interface Applicant {
  id: string;
  name: string;
  email: string;
  phone?: string;
  hostel?: string;
  picture?: string;
  submittedAt?: string;
}

interface Room {
  id: string;
  room_number: string;
  capacity: number;
  occupied_count: number;
  status: 'available' | 'full';
}

interface CompleteRegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicant: Applicant | null;
  onSuccess: () => void;
}

export function CompleteRegistrationDialog({
  open,
  onOpenChange,
  applicant,
  onSuccess,
}: CompleteRegistrationDialogProps) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [hostel, setHostel] = useState('Q2');
  const [selectedRoomNumber, setSelectedRoomNumber] = useState('');
  const [fees, setFees] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [initialFeePaid, setInitialFeePaid] = useState(false);

  // Sync applicant details when applicant changes
  useEffect(() => {
    if (applicant) {
      setName(applicant.name || '');
      const userEmail = (applicant.email || '').toLowerCase().trim();
      setEmail(userEmail);
      // User ID and Password default to the Google authentication email as required
      setUsername(userEmail);
      setPassword(userEmail);
      setPhone(applicant.phone || '');
      setParentPhone('');
      setHostel(applicant.hostel || 'Q2');
      setSelectedRoomNumber('');
      setFees('');
      setStartDate(new Date());
      setInitialFeePaid(false);
    }
  }, [applicant]);

  // Fetch rooms whenever selected hostel changes
  useEffect(() => {
    if (open && hostel) {
      const fetchRoomsForHostel = async () => {
        try {
          setRoomsLoading(true);
          const res = await api.get('/rooms', { params: { hostel } });
          if (res.data?.success) {
            const mapped = (res.data.data || []).map((r: any) => ({
              id: r._id,
              room_number: r.roomNumber,
              capacity: r.capacity,
              occupied_count: r.occupiedCount,
              status: r.status,
            }));
            setRooms(mapped);
          }
        } catch (err) {
          console.error('Failed to load rooms for hostel', err);
          setRooms([]);
        } finally {
          setRoomsLoading(false);
        }
      };
      fetchRoomsForHostel();
    }
  }, [open, hostel]);

  if (!applicant) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicant?.id) return;

    if (!username.trim()) {
      toast.error('User ID is required');
      return;
    }

    if (!password.trim()) {
      toast.error('Password is required');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.post(`/students/approve-and-register/${applicant.id}`, {
        name: name.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        password: password.trim(),
        phone: phone.trim(),
        parentPhone: parentPhone.trim(),
        roomNo: selectedRoomNumber,
        hostel,
        fees: fees ? parseFloat(fees) : 0,
        startDate: startDate ? format(startDate, 'yyyy-MM-dd') : null,
        initialFeePaid,
      });

      if (res.data?.success) {
        toast.success(`Resident ${name} registered successfully! Welcome email & confirmation sent to admin.`);
        onOpenChange(false);
        onSuccess();
      }
    } catch (err: any) {
      console.error('Failed to register student:', err);
      toast.error(err.response?.data?.message || 'Failed to complete registration');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenFullPage = () => {
    onOpenChange(false);
    navigate(`/admin/register-student?applicantId=${applicant.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
        <DialogHeader className="pb-2 border-b border-border/60">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-foreground flex items-center gap-2.5 text-lg font-bold">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <UserPlus className="w-4 h-4" />
              </div>
              Complete Resident Registration
            </DialogTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleOpenFullPage}
              className="text-xs text-muted-foreground hover:text-foreground gap-1 h-7"
            >
              <span>Full Page Form</span>
              <ExternalLink className="w-3 h-3" />
            </Button>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Assign room, parent contact, and fees. User ID, Email, and Password default to their Google credentials.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Top Applicant Banner */}
          <div className="p-3 bg-secondary/60 rounded-xl border border-border/80 flex items-center gap-3">
            {applicant.picture ? (
              <img
                src={applicant.picture}
                alt={applicant.name}
                className="w-10 h-10 rounded-full border border-border object-cover shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                {applicant.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-foreground text-sm truncate">{applicant.name}</div>
              <div className="text-xs text-muted-foreground truncate">{applicant.email}</div>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                Pending Approval
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Full Name */}
            <div className="space-y-1.5">
              <Label htmlFor="reg-name" className="text-xs font-semibold text-foreground">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="reg-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-secondary/70 border-border text-xs h-9"
              />
            </div>

            {/* Email (Google) */}
            <div className="space-y-1.5">
              <Label htmlFor="reg-email" className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Mail className="w-3 h-3 text-muted-foreground" /> Google Email
              </Label>
              <Input
                id="reg-email"
                value={email}
                disabled
                className="bg-muted/60 border-border text-xs h-9 cursor-not-allowed text-muted-foreground"
              />
            </div>

            {/* User ID */}
            <div className="space-y-1.5">
              <Label htmlFor="reg-username" className="text-xs font-semibold text-foreground">
                User ID (for login) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="reg-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="bg-secondary/70 border-border text-xs h-9 font-mono"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="reg-password" className="text-xs font-semibold text-foreground">
                  Login Password <span className="text-destructive">*</span>
                </Label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
                >
                  {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <Input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-secondary/70 border-border text-xs h-9 font-mono"
              />
            </div>

            {/* Student Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="reg-phone" className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Phone className="w-3 h-3 text-muted-foreground" /> Student Phone
              </Label>
              <Input
                id="reg-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 XXXXXXXXXX"
                className="bg-secondary/70 border-border text-xs h-9"
              />
            </div>

            {/* Parent Mobile */}
            <div className="space-y-1.5">
              <Label htmlFor="reg-parent-phone" className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Phone className="w-3 h-3 text-muted-foreground" /> Parent's Mobile
              </Label>
              <Input
                id="reg-parent-phone"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                placeholder="+91 XXXXXXXXXX"
                className="bg-secondary/70 border-border text-xs h-9"
              />
            </div>

            {/* Hostel Branch */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Home className="w-3 h-3 text-muted-foreground" /> Hostel Branch
              </Label>
              <Select value={hostel} onValueChange={(val) => { setHostel(val); setSelectedRoomNumber(''); }}>
                <SelectTrigger className="bg-secondary/70 border-border text-xs h-9">
                  <SelectValue placeholder="Select hostel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Q2">Q2 (Main)</SelectItem>
                  <SelectItem value="Q2.0">Q2.0</SelectItem>
                  <SelectItem value="Q2.1">Q2.1</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Room Assignment */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Assigned Room
              </Label>
              <Select value={selectedRoomNumber} onValueChange={setSelectedRoomNumber}>
                <SelectTrigger className="bg-secondary/70 border-border text-xs h-9">
                  <SelectValue placeholder={roomsLoading ? "Loading rooms..." : "Choose Room"} />
                </SelectTrigger>
                <SelectContent>
                  {rooms.length === 0 ? (
                    <SelectItem value="none" disabled>
                      {roomsLoading ? "Fetching rooms..." : "No rooms configured"}
                    </SelectItem>
                  ) : (
                    rooms.map((room) => {
                      const isFull = room.occupied_count >= room.capacity;
                      return (
                        <SelectItem
                          key={room.id}
                          value={room.room_number}
                          disabled={isFull}
                        >
                          Room {room.room_number} ({room.occupied_count}/{room.capacity}) {isFull ? '• Full' : '• Available'}
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Monthly Fees */}
            <div className="space-y-1.5">
              <Label htmlFor="reg-fees" className="text-xs font-semibold text-foreground">
                Monthly Fees (₹)
              </Label>
              <Input
                id="reg-fees"
                type="number"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
                placeholder="e.g. 8500"
                className="bg-secondary/70 border-border text-xs h-9"
              />
            </div>

            {/* Joining Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Joining Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal bg-secondary/70 border-border text-xs h-9"
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {startDate ? format(startDate, 'PPP') : <span>Pick date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Initial Fee Paid Checkbox */}
          <div className="flex items-center space-x-2 pt-2 pb-1 border-t border-border/50">
            <Checkbox
              id="initialFeePaid"
              checked={initialFeePaid}
              onCheckedChange={(checked) => setInitialFeePaid(checked === true)}
            />
            <Label htmlFor="initialFeePaid" className="text-xs font-medium cursor-pointer text-foreground">
              Collect initial monthly fee now (generates cash receipt & marks current month as Paid)
            </Label>
          </div>

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-4 gap-1.5 shadow-md"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Register & Approve Student</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
