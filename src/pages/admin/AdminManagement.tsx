import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Shield, UserPlus, Trash2, Eye, EyeOff } from 'lucide-react';
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
  DialogTrigger,
} from '@/components/ui/dialog';

interface AdminUser {
  id: string;
  user_id: string;
  name: string;
  username: string | null;
  created_at: string;
  is_primary: boolean;
}

const PRIMARY_ADMIN_USERNAME = 'abhi1006';

export default function AdminManagement() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPrimaryAdmin, setIsPrimaryAdmin] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate('/admin-login');
    }
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchAdmins();
      checkPrimaryAdmin();
    }
  }, [user, isAdmin]);

  const checkPrimaryAdmin = async () => {
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('is_primary')
        .eq('user_id', user?.id)
        .eq('role', 'admin')
        .maybeSingle();
      
      setIsPrimaryAdmin(!!data?.is_primary);
    } catch (error) {
      console.error('Error checking primary admin:', error);
    }
  };

  const fetchAdmins = async () => {
    try {
      setIsLoading(true);
      
      // Get all admin user_ids with their is_primary flag
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id, is_primary')
        .eq('role', 'admin');

      if (roleError) throw roleError;

      if (!roleData || roleData.length === 0) {
        setAdmins([]);
        setIsLoading(false);
        return;
      }

      // Get profiles for all admin users
      const adminUserIds = roleData.map(r => r.user_id);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, user_id, name, username, created_at')
        .in('user_id', adminUserIds);

      if (profileError) throw profileError;

      // Create a map of user_id -> is_primary from role data
      const primaryMap = new Map(roleData.map(r => [r.user_id, r.is_primary]));

      // Merge profile data with role data
      const adminsList: AdminUser[] = (profileData || []).map(profile => ({
        ...profile,
        is_primary: primaryMap.get(profile.user_id) || false,
      }));

      // Sort: primary admins first
      adminsList.sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));

      setAdmins(adminsList);
    } catch (error) {
      console.error('Error fetching admins:', error);
      toast.error('Failed to fetch admins');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.username || !formData.password) {
      toast.error('Please fill in all fields');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    // Check if username already exists
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', formData.username.toLowerCase())
      .maybeSingle();

    if (existingUser) {
      toast.error('User ID already exists');
      return;
    }

    setIsSubmitting(true);

    try {
      const email = `${formData.username.toLowerCase()}@q2hostel.local`;
      
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { name: formData.username },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      // Update profile with username
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: formData.username,
          username: formData.username.toLowerCase(),
        })
        .eq('user_id', authData.user.id);

      if (profileError) throw profileError;

      // Add admin role (secondary)
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: 'admin',
          is_primary: false,
        });

      if (roleError) throw roleError;

      toast.success('Admin created successfully!');
      setFormData({ name: '', username: '', password: '' });
      setIsDialogOpen(false);
      fetchAdmins();
    } catch (error: any) {
      console.error('Error creating admin:', error);
      toast.error(error.message || 'Failed to create admin');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteAdmin = async (userId: string) => {
    // Check if trying to delete primary admin
    const adminToDelete = admins.find(a => a.user_id === userId);
    if (adminToDelete?.username?.toLowerCase() === PRIMARY_ADMIN_USERNAME) {
      toast.error('Primary Admin cannot be deleted');
      return;
    }

    if (!confirm('Are you sure you want to delete this admin?')) return;

    try {
      // Delete role first
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (roleError) throw roleError;

      toast.success('Admin deleted successfully');
      fetchAdmins();
    } catch (error) {
      console.error('Error deleting admin:', error);
      toast.error('Failed to delete admin');
    }
  };

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-foreground">Admin Management</h2>
            <p className="text-muted-foreground text-sm">{admins.length} admin(s)</p>
          </div>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="hero" className="w-full sm:w-auto">
              <UserPlus className="w-4 h-4 mr-2" />
              Add New Admin
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground">Add New Admin</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddAdmin} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="admin-username" className="text-foreground">User ID</Label>
                <Input
                  id="admin-username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Enter User ID"
                  required
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password" className="text-foreground">Password</Label>
                <div className="relative">
                  <Input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Create password"
                    required
                    minLength={6}
                    className="bg-secondary border-border pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" variant="hero" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Admin'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Mobile Card View */}
        <div className="block md:hidden space-y-3">
          {admins.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center">
                <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No admins found</p>
              </CardContent>
            </Card>
          ) : (
            admins.map((admin) => (
              <Card key={admin.id} className="bg-card border-border">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{admin.name}</p>
                      <p className="text-xs text-muted-foreground">{admin.username || '-'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={admin.is_primary ? 'default' : 'secondary'} className={admin.is_primary ? 'bg-primary text-primary-foreground text-xs' : 'text-xs'}>
                        {admin.is_primary ? 'Primary' : 'Secondary'}
                      </Badge>
                      {!admin.is_primary && (
                        <Button size="sm" variant="ghost" onClick={() => deleteAdmin(admin.user_id)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
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
                  <TableHead className="text-foreground font-bold">Status</TableHead>
                  <TableHead className="text-foreground font-bold hidden lg:table-cell">Created At</TableHead>
                  <TableHead className="text-foreground font-bold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow key={admin.id} className="border-border hover:bg-secondary/30">
                    <TableCell className="font-medium text-foreground">{admin.name}</TableCell>
                    <TableCell>
                      <Badge variant={admin.is_primary ? 'default' : 'secondary'} className={admin.is_primary ? 'bg-primary text-primary-foreground' : ''}>
                        {admin.is_primary ? 'Primary Admin' : 'Secondary Admin'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{admin.username || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-green-500 border-green-500/30">Active</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden lg:table-cell">
                      {new Date(admin.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </TableCell>
                    <TableCell>
                      {!admin.is_primary && (
                        <Button size="sm" variant="ghost" onClick={() => deleteAdmin(admin.user_id)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
              <p className="text-muted-foreground">No admins found</p>
            </CardContent>
          )}
        </Card>
      </motion.div>
    </div>
  );
}