import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Building, Phone, User as UserIcon, Send, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'react-toastify';

interface GoogleInitialDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  googleProfile: {
    email: string;
    name: string;
    picture?: string;
    googleId?: string;
  };
  onSubmitDetails: (details: { name: string; phone: string; hostel: string }) => Promise<void>;
  isLoading: boolean;
}

export const GoogleInitialDetailsModal: React.FC<GoogleInitialDetailsModalProps> = ({
  isOpen,
  onClose,
  googleProfile,
  onSubmitDetails,
  isLoading,
}) => {
  const [name, setName] = useState(googleProfile?.name || '');
  const [phone, setPhone] = useState('');
  const [hostel, setHostel] = useState('Q2');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.trim().length < 10) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }
    await onSubmitDetails({ name: name.trim() || googleProfile.name, phone: phone.trim(), hostel });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border/80 bg-card p-6 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center gap-3 pb-4 border-b border-border/60">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Resident Registration</h2>
              <p className="text-xs text-muted-foreground">Step 1 of 2: Submit profile for Admin approval</p>
            </div>
          </div>

          {/* Google Verified Banner */}
          <div className="my-4 flex items-center gap-3 rounded-xl bg-secondary/50 p-3 border border-border/60">
            {googleProfile?.picture ? (
              <img
                src={googleProfile.picture}
                alt={googleProfile.name}
                className="h-10 w-10 rounded-full border border-border object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-sm">
                {googleProfile?.name?.charAt(0) || 'G'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-xs text-foreground truncate">{googleProfile?.name}</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              </div>
              <p className="text-[11px] text-muted-foreground truncate">{googleProfile?.email}</p>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              Google Verified
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div className="space-y-1">
              <Label htmlFor="resident-name" className="text-xs font-semibold">Resident Full Name</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="resident-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Priya Sharma"
                  className="pl-9 h-10"
                  required
                />
              </div>
            </div>

            {/* Mobile Number */}
            <div className="space-y-1">
              <Label htmlFor="resident-phone" className="text-xs font-semibold">Mobile Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="resident-phone"
                  type="tel"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="10-digit mobile number"
                  className="pl-9 h-10"
                  required
                />
              </div>
            </div>

            {/* Hostel Branch Selection */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Preferred Hostel Property</Label>
              <Select value={hostel} onValueChange={setHostel}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select hostel branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Q2">Q2 Girls Hostel - Gachibowli</SelectItem>
                  <SelectItem value="Q2.0">Q2 Girls Hostel - Kondapur</SelectItem>
                  <SelectItem value="Q2.1">Q2 Girls Hostel - Madhapur</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Admin Verification Notice */}
            <div className="rounded-xl border border-border/60 bg-muted/40 p-3 text-[11px] text-muted-foreground flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>
                Your registration will be sent to the hostel administrator for review. Once verified, you can sign in with Google anytime to choose your permanent username and password.
              </span>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 h-10 rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 h-10 rounded-xl text-xs font-bold gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                {isLoading ? 'Submitting...' : 'Submit to Admin'}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
