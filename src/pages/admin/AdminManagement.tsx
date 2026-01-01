import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Shield, UserPlus, Trash2 } from 'lucide-react';
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

const PRIMARY_ADMIN_NAME = 'Mr. Abhigyanam Giri';
const PRIMARY_ADMIN_USERNAME = 'abhigyanam';

function AdminManagementContent() {
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
      
      // Get all admin user_ids
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id, is_primary')
        .eq('role', 'admin');

      if (roleError) throw roleError;

      if (!roleData || roleData.length === 0) {
        // No admins exist, show only the default primary admin
        setAdmins([{
          id: 'default-primary',
          user_id: 'default-primary',
          name: PRIMARY_ADMIN_NAME,
          username: PRIMARY_ADMIN_USERNAME,
          created_at: new Date().toISOString(),
          is_primary: true,
        }]);
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

      // Merge profile data with role data
      const adminsList: AdminUser[] = (profileData || []).map(profile => {
        const roleInfo = roleData.find(r => r.user_id === profile.user_id);
        return {
          ...profile,
          is_primary: roleInfo?.is_primary || false,
        };
      });

      // Add default primary admin if not in list
      const hasPrimaryAdmin = adminsList.some(a => a.is_primary);
      if (!hasPrimaryAdmin) {
        adminsList.unshift({
          id: 'default-primary',
          user_id: 'default-primary',
          name: PRIMARY_ADMIN_NAME,
          username: PRIMARY_ADMIN_USERNAME,
          created_at: new Date().toISOString(),
          is_primary: true,
        });
      }

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
    
    if (!isPrimaryAdmin) {
      toast.error('Only Primary Admin can add new admins');
      return;
    }

    if (!formData.name || !formData.username || !formData.password) {
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
      toast.error('Username already exists');
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
          data: { name: formData.name },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      // Update profile with username
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: formData.name,
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
    if (!isPrimaryAdmin) {
      toast.error('Only Primary Admin can delete admins');
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Admin Management</h2>
            <p className="text-muted-foreground text-sm">{admins.length} admin(s)</p>
          </div>
        </div>
        
        {isPrimaryAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="hero">
                <UserPlus className="w-4 h-4 mr-2" />
                Add New Admin
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Add New Admin</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddAdmin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-name" className="text-foreground">Full Name</Label>
                  <Input
                    id="admin-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter admin name"
                    required
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-username" className="text-foreground">Username</Label>
                  <Input
                    id="admin-username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="Enter username"
                    required
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-password" className="text-foreground">Password</Label>
                  <Input
                    id="admin-password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Create password"
                    required
                    minLength={6}
                    className="bg-secondary border-border"
                  />
                </div>
                <Button type="submit" variant="hero" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Admin'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="bg-card border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-secondary/50">
                <TableHead className="text-foreground font-bold">Admin Name</TableHead>
                <TableHead className="text-foreground font-bold">Role</TableHead>
                <TableHead className="text-foreground font-bold">Username</TableHead>
                <TableHead className="text-foreground font-bold">Status</TableHead>
                <TableHead className="text-foreground font-bold">Created</TableHead>
                {isPrimaryAdmin && <TableHead className="text-foreground font-bold">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((admin) => (
                <TableRow key={admin.id} className="border-border hover:bg-secondary/30">
                  <TableCell className="font-medium text-foreground">{admin.name}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={admin.is_primary ? 'default' : 'secondary'}
                      className={admin.is_primary ? 'bg-primary text-primary-foreground' : ''}
                    >
                      {admin.is_primary ? 'Primary Admin' : 'Secondary Admin'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{admin.username || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-green-500 border-green-500/30">
                      Active
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(admin.created_at).toLocaleDateString()}
                  </TableCell>
                  {isPrimaryAdmin && (
                    <TableCell>
                      {!admin.is_primary && admin.user_id !== 'default-primary' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteAdmin(admin.user_id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>

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

export default function AdminManagement() {
  return (
    <AdminLayout title="Admin Management">
      <AdminManagementContent />
    </AdminLayout>
  );
}