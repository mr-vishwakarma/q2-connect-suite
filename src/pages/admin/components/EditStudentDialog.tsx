import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import React from 'react';

interface EditStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editForm: {
    name: string;
    room_no: string;
    fees: string;
    username: string;
  };
  setEditForm: (form: any) => void;
  editStartDate: Date | undefined;
  setEditStartDate: (date: Date | undefined) => void;
  editEndDate: Date | undefined;
  setEditEndDate: (date: Date | undefined) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
}

export function EditStudentDialog({
  open,
  onOpenChange,
  editForm,
  setEditForm,
  editStartDate,
  setEditStartDate,
  editEndDate,
  setEditEndDate,
  onSubmit,
  submitting
}: EditStudentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Edit Student</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 mt-4">
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
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Updating...' : 'Save Changes'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
