import { InlineSkeletonList } from '@/components/ui/dashboard-skeleton';
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useHostel } from '@/contexts/HostelContext';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import {
  Shield,
  UserPlus,
  Trash2,
  Mail,
  KeyRound,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Lock,
  UserCheck,
} from 'lucide-react';
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
  DialogDescription,
} from '@/components/ui/dialog';
import { formatDateDMY } from '@/utils/dateUtils';

interface AdminUser {
  id: string;
  user_id: string;
  name: string;
  username: string | null;
  email: string;
  phone?: string;
  role: string;
  status: 'ACTIVE' | 'INVITED' | 'DEACTIVATED' | 'SUSPENDED';
  created_at: string;
  is_primary: boolean;
  isPrimaryAdmin: boolean;
  hostels?: string[];
}

export default function AdminManagement() {
  const { user, isAdmin, loading } = useAuth();
  const { branches, selectedHostelId } = useHostel();
  const navigate = useNavigate();

  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPrimaryAdmin, setIsPrimaryAdmin] = useState(false);

  // Create Admin Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<'FORM' | 'OTP'>('FORM');
  const [createForm, setCreateForm] = useState({
    name: '',
    username: '',
    email: '',
    phone: '',
    hostelId: '',
  });
  const [createOtp, setCreateOtp] = useState('');
  const [createCooldown, setCreateCooldown] = useState(0);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Delete/Deactivate Admin Modal State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [targetAdmin, setTargetAdmin] = useState<AdminUser | null>(null);
  const [deleteStep, setDeleteStep] = useState<'CONFIRM' | 'OTP'>('CONFIRM');
  const [deleteOtp, setDeleteOtp] = useState('');
  const [deleteCooldown, setDeleteCooldown] = useState(0);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  // Resend Invite State
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Auth gate
  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate('/login?role=admin');
    }
  }, [user, isAdmin, loading, navigate]);

  // Cooldown timers
  useEffect(() => {
    if (createCooldown <= 0) return;
    const timer = setInterval(() => {
      setCreateCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [createCooldown]);

  useEffect(() => {
    if (deleteCooldown <= 0) return;
    const timer = setInterval(() => {
      setDeleteCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [deleteCooldown]);

  const fetchAdmins = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/admins');
      if (response.data?.success) {
        const rawList = Array.isArray(response.data.data) ? response.data.data : [];
        setAdmins(rawList);
        if (typeof response.data.isCallerPrimaryAdmin === 'boolean') {
          setIsPrimaryAdmin(response.data.isCallerPrimaryAdmin);
        }
      }
    } catch (error: any) {
      console.error('Error fetching admins:', error);
      toast.error(error.response?.data?.message || 'Failed to load administrator directory');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && isAdmin) {
      fetchAdmins();
    }
  }, [user, isAdmin, fetchAdmins]);

  // Open Create Dialog
  const handleOpenCreate = () => {
    setCreateStep('FORM');
    setCreateForm({
      name: '',
      username: '',
      email: '',
      phone: '',
      hostelId: selectedHostelId || (branches[0]?._id ?? ''),
    });
    setCreateOtp('');
    setCreateCooldown(0);
    setIsCreateOpen(true);
  };

  // Step 1: Request OTP for Creating Secondary Admin
  const handleRequestCreateOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.username.trim() || !createForm.email.trim()) {
      toast.error('Please enter Name, User ID, and Email address.');
      return;
    }

    setIsSubmittingCreate(true);
    try {
      const res = await api.post('/admins/request-create-otp', createForm);
      if (res.data?.success) {
        toast.info(res.data.message || 'Verification code sent to your Primary Admin email.');
        setCreateStep('OTP');
        setCreateCooldown(res.data.cooldownSeconds || 60);
      }
    } catch (err: any) {
      console.error('Error requesting create OTP:', err);
      toast.error(err.response?.data?.message || 'Failed to request verification code');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Step 2: Verify OTP and Create Secondary Admin
  const handleVerifyCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createOtp || createOtp.trim().length < 6) {
      toast.error('Please enter the 6-digit verification code.');
      return;
    }

    setIsSubmittingCreate(true);
    try {
      const res = await api.post('/admins/verify-create', {
        otp: createOtp.trim(),
      });
      if (res.data?.success) {
        toast.success(res.data.message || 'Secondary Admin created successfully!');
        setIsCreateOpen(false);
        fetchAdmins();
      }
    } catch (err: any) {
      console.error('Error verifying create OTP:', err);
      toast.error(err.response?.data?.message || 'Failed to verify code');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Open Delete Dialog
  const handleOpenDelete = (admin: AdminUser) => {
    if (admin.is_primary || admin.isPrimaryAdmin) {
      toast.error('Primary Admin cannot be deactivated or deleted.');
      return;
    }
    setTargetAdmin(admin);
    setDeleteStep('CONFIRM');
    setDeleteOtp('');
    setDeleteCooldown(0);
    setIsDeleteOpen(true);
  };

  // Step 1: Request OTP for Deactivating Admin
  const handleRequestDeleteOtp = async () => {
    if (!targetAdmin) return;
    setIsSubmittingDelete(true);
    try {
      const res = await api.post('/admins/request-delete-otp', {
        targetAdminId: targetAdmin.id,
      });
      if (res.data?.success) {
        toast.info(res.data.message || 'Verification code sent to your Primary Admin email.');
        setDeleteStep('OTP');
        setDeleteCooldown(res.data.cooldownSeconds || 60);
      }
    } catch (err: any) {
      console.error('Error requesting delete OTP:', err);
      toast.error(err.response?.data?.message || 'Failed to request verification code');
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // Step 2: Verify OTP and Deactivate Admin
  const handleVerifyDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAdmin || !deleteOtp || deleteOtp.trim().length < 6) {
      toast.error('Please enter the 6-digit verification code.');
      return;
    }

    setIsSubmittingDelete(true);
    try {
      const res = await api.post('/admins/verify-delete', {
        otp: deleteOtp.trim(),
        targetAdminId: targetAdmin.id,
      });
      if (res.data?.success) {
        toast.success(res.data.message || 'Secondary Admin deactivated successfully.');
        setIsDeleteOpen(false);
        fetchAdmins();
      }
    } catch (err: any) {
      console.error('Error verifying delete OTP:', err);
      toast.error(err.response?.data?.message || 'Failed to deactivate admin');
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // Resend Invite Action
  const handleResendInvite = async (adminId: string, email: string) => {
    setResendingId(adminId);
    try {
      const res = await api.post(`/admins/${adminId}/resend-invite`);
      if (res.data?.success) {
        toast.success(`Activation invite resent to ${email}`);
      }
    } catch (err: any) {
      console.error('Error resending invite:', err);
      toast.error(err.response?.data?.message || 'Failed to resend invitation');
    } finally {
      setResendingId(null);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="py-8">
        <InlineSkeletonList rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header & Primary Admin Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-foreground">Admin Management</h2>
              {isPrimaryAdmin ? (
                <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs">
                  Primary Admin
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground border-border">
                  Secondary Admin
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              {admins.length} administrator account{admins.length === 1 ? '' : 's'} in your authorized hostel scope
            </p>
          </div>
        </div>

        {isPrimaryAdmin && (
          <Button variant="hero" onClick={handleOpenCreate} className="w-full sm:w-auto">
            <UserPlus className="w-4 h-4 mr-2" />
            Add New Admin
          </Button>
        )}
      </div>

      {/* Secondary Admin Read-Only Notice */}
      {!isPrimaryAdmin && (
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-3.5 text-xs text-primary flex items-center gap-2.5">
          <Shield className="w-4 h-4 shrink-0 text-primary" />
          <span>
            You are viewing the Administrator Directory as a Secondary Admin. Adding, modifying, or deactivating administrator accounts requires Primary Administrator email OTP authorization.
          </span>
        </div>
      )}

      {/* Directory Content */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        {/* Mobile View */}
        <div className="block md:hidden space-y-3">
          {admins.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center">
                <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No administrators found</p>
              </CardContent>
            </Card>
          ) : (
            admins.map((admin) => (
              <Card key={admin.id} className="bg-card border-border">
                <CardContent className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-foreground text-sm">{admin.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{admin.username || '-'}</p>
                      <p className="text-xs text-muted-foreground">{admin.email}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <Badge
                        variant={admin.is_primary ? 'default' : 'secondary'}
                        className={
                          admin.is_primary
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px]'
                            : 'text-[10px]'
                        }
                      >
                        {admin.is_primary ? 'Primary' : 'Secondary'}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={
                          admin.status === 'ACTIVE'
                            ? 'text-emerald-400 border-emerald-500/30 text-[10px]'
                            : admin.status === 'INVITED'
                            ? 'text-amber-400 border-amber-500/30 text-[10px]'
                            : 'text-red-400 border-red-500/30 text-[10px]'
                        }
                      >
                        {admin.status}
                      </Badge>
                    </div>
                  </div>

                  {isPrimaryAdmin && !admin.is_primary && (
                    <div className="pt-2 border-t border-border/50 flex justify-end gap-2">
                      {admin.status === 'INVITED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={resendingId === admin.id}
                          onClick={() => handleResendInvite(admin.id, admin.email)}
                          className="h-8 text-xs border-amber-500/30 text-amber-400"
                        >
                          <Mail className="w-3.5 h-3.5 mr-1" />
                          {resendingId === admin.id ? 'Resending...' : 'Resend Invite'}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenDelete(admin)}
                        className="h-8 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Deactivate
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <Card className="bg-card border-border overflow-hidden hidden md:block">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-secondary/50">
                  <TableHead className="text-foreground font-bold">Admin Name</TableHead>
                  <TableHead className="text-foreground font-bold">Role</TableHead>
                  <TableHead className="text-foreground font-bold">User ID</TableHead>
                  <TableHead className="text-foreground font-bold">Email Address</TableHead>
                  <TableHead className="text-foreground font-bold">Status</TableHead>
                  <TableHead className="text-foreground font-bold hidden lg:table-cell">Created At</TableHead>
                  <TableHead className="text-foreground font-bold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow key={admin.id} className="border-border hover:bg-secondary/30">
                    <TableCell className="font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        {admin.is_primary ? (
                          <Shield className="w-4 h-4 text-amber-400 shrink-0" />
                        ) : (
                          <UserCheck className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <span>{admin.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={admin.is_primary ? 'default' : 'secondary'}
                        className={
                          admin.is_primary
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : ''
                        }
                      >
                        {admin.is_primary ? 'Primary Admin' : 'Secondary Admin'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {admin.username || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{admin.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          admin.status === 'ACTIVE'
                            ? 'text-emerald-400 border-emerald-500/30'
                            : admin.status === 'INVITED'
                            ? 'text-amber-400 border-amber-500/30'
                            : 'text-red-400 border-red-500/30'
                        }
                      >
                        {admin.status === 'INVITED' ? 'Pending Activation' : admin.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden lg:table-cell text-xs">
                      {formatDateDMY(admin.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      {admin.is_primary ? (
                        <span className="text-xs text-muted-foreground font-mono">Protected</span>
                      ) : isPrimaryAdmin ? (
                        <div className="flex items-center justify-end gap-1.5">
                          {admin.status === 'INVITED' && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={resendingId === admin.id}
                              onClick={() => handleResendInvite(admin.id, admin.email)}
                              className="h-8 px-2 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                              title="Resend Activation Email"
                            >
                              <Mail className="w-3.5 h-3.5 mr-1" />
                              {resendingId === admin.id ? 'Sending...' : 'Invite'}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenDelete(admin)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 px-2"
                            title="Deactivate Secondary Admin"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Deactivate
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {admins.length === 0 && (
            <CardContent className="py-12 text-center">
              <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No administrators found</p>
            </CardContent>
          )}
        </Card>
      </motion.div>

      {/* CREATE SECONDARY ADMIN DIALOG (TWO-STEP OTP VERIFICATION) */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-400" />
              Add Secondary Administrator
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              {createStep === 'FORM'
                ? 'Enter the staff administrator details. An email OTP will be sent to the Primary Admin to authorize creation.'
                : `Enter the 6-digit verification code sent to your Primary Admin email (${user?.email}).`}
            </DialogDescription>
          </DialogHeader>

          {createStep === 'FORM' ? (
            <form onSubmit={handleRequestCreateOtp} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label htmlFor="admin-name" className="text-xs text-foreground">
                  Full Name <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="admin-name"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="e.g. Ramesh Verma"
                  required
                  className="bg-secondary border-border"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-username" className="text-xs text-foreground">
                  User ID (Login Username) <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="admin-username"
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                  placeholder="e.g. ramesh_admin"
                  required
                  minLength={3}
                  className="bg-secondary border-border font-mono text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-email" className="text-xs text-foreground">
                  Email Address <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="e.g. ramesh@q2hostel.com"
                  required
                  className="bg-secondary border-border"
                />
                <p className="text-[11px] text-muted-foreground">
                  A secure single-use activation link will be sent to this email address for password setup.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-phone" className="text-xs text-foreground">
                  Phone Number (Optional)
                </Label>
                <Input
                  id="admin-phone"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  placeholder="e.g. 9876543210"
                  className="bg-secondary border-border"
                />
              </div>

              {branches.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="admin-hostel" className="text-xs text-foreground">
                    Assigned Hostel Branch
                  </Label>
                  <Select
                    value={createForm.hostelId}
                    onValueChange={(val) => setCreateForm({ ...createForm, hostelId: val })}
                  >
                    <SelectTrigger id="admin-hostel" className="bg-secondary border-border">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b._id} value={b._id}>
                          {b.name} ({b.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="pt-2 flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="hero" disabled={isSubmittingCreate}>
                  {isSubmittingCreate ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Requesting Code...
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4 mr-2" />
                      Send Verification Code
                    </>
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyCreate} className="space-y-4 mt-2">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-300 space-y-1">
                <div className="flex items-center gap-2 font-semibold">
                  <Lock className="w-4 h-4 text-amber-400" />
                  Primary Admin Verification Required
                </div>
                <p>
                  A 6-digit OTP was sent to <strong>{user?.email}</strong> to authorize creating secondary admin{' '}
                  <strong>{createForm.username}</strong>.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-otp" className="text-xs text-foreground">
                  Enter 6-Digit Verification Code
                </Label>
                <Input
                  id="create-otp"
                  value={createOtp}
                  onChange={(e) => setCreateOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="• • • • • •"
                  maxLength={6}
                  required
                  autoFocus
                  className="bg-secondary border-border text-center text-xl tracking-[0.5em] font-mono h-12"
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setCreateStep('FORM')}
                  className="text-muted-foreground hover:text-foreground underline"
                >
                  ← Edit Admin Details
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={createCooldown > 0 || isSubmittingCreate}
                  onClick={handleRequestCreateOtp}
                  className="text-xs text-amber-400 hover:text-amber-300"
                >
                  {createCooldown > 0 ? `Resend Code in ${createCooldown}s` : 'Resend Code'}
                </Button>
              </div>

              <Button
                type="submit"
                variant="hero"
                className="w-full"
                disabled={isSubmittingCreate || createOtp.length < 6}
              >
                {isSubmittingCreate ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Verifying & Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Verify & Create Administrator
                  </>
                )}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* DELETE/DEACTIVATE SECONDARY ADMIN DIALOG (TWO-STEP OTP VERIFICATION) */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Deactivate Administrator Account
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              {deleteStep === 'CONFIRM'
                ? 'Deactivating an administrator will revoke all active sessions and block login access.'
                : `Enter the 6-digit verification code sent to your Primary Admin email (${user?.email}).`}
            </DialogDescription>
          </DialogHeader>

          {targetAdmin && deleteStep === 'CONFIRM' && (
            <div className="space-y-4 mt-2">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-xs text-destructive space-y-1.5">
                <p className="font-semibold">Target Account:</p>
                <div className="font-mono text-foreground">
                  <p>Name: {targetAdmin.name}</p>
                  <p>User ID: {targetAdmin.username}</p>
                  <p>Email: {targetAdmin.email}</p>
                </div>
                <p className="pt-1 text-[11px] text-muted-foreground">
                  This action is protected and requires Primary Admin email OTP verification before execution.
                </p>
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsDeleteOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isSubmittingDelete}
                  onClick={handleRequestDeleteOtp}
                >
                  {isSubmittingDelete ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Sending Code...
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4 mr-2" />
                      Send Deactivation Code
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {targetAdmin && deleteStep === 'OTP' && (
            <form onSubmit={handleVerifyDelete} className="space-y-4 mt-2">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-300 space-y-1">
                <div className="flex items-center gap-2 font-semibold">
                  <Lock className="w-4 h-4 text-amber-400" />
                  Primary Admin Authorization
                </div>
                <p>
                  Enter the verification code sent to <strong>{user?.email}</strong> to authorize deactivating{' '}
                  <strong>{targetAdmin.username}</strong>.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="delete-otp" className="text-xs text-foreground">
                  Enter 6-Digit Verification Code
                </Label>
                <Input
                  id="delete-otp"
                  value={deleteOtp}
                  onChange={(e) => setDeleteOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="• • • • • •"
                  maxLength={6}
                  required
                  autoFocus
                  className="bg-secondary border-border text-center text-xl tracking-[0.5em] font-mono h-12"
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setDeleteStep('CONFIRM')}
                  className="text-muted-foreground hover:text-foreground underline"
                >
                  ← Back
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={deleteCooldown > 0 || isSubmittingDelete}
                  onClick={handleRequestDeleteOtp}
                  className="text-xs text-amber-400 hover:text-amber-300"
                >
                  {deleteCooldown > 0 ? `Resend Code in ${deleteCooldown}s` : 'Resend Code'}
                </Button>
              </div>

              <Button
                type="submit"
                variant="destructive"
                className="w-full"
                disabled={isSubmittingDelete || deleteOtp.length < 6}
              >
                {isSubmittingDelete ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Verifying & Deactivating...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Verify & Deactivate Administrator
                  </>
                )}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}