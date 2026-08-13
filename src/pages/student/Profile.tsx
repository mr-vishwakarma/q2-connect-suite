import { useState, useEffect, useRef } from 'react';
import { InlineSkeletonList } from '@/components/ui/dashboard-skeleton';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { toast } from 'react-toastify';
import { Loader2, Camera, User, Mail, Phone, Home, Calendar, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { profile: authProfile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    phone: '',
    parentPhone: '',
    address: '',
    dob: '',
    profilePhoto: '',
    profilePhotoFileId: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/auth/me');
      const { user, student } = response.data;
      
      setFormData({
        name: student?.name || user?.name || '',
        username: user?.username || '',
        email: user?.email || '',
        phone: student?.phone || '',
        parentPhone: student?.parentPhone || '',
        address: student?.address || '',
        dob: student?.dob ? new Date(student.dob).toISOString().split('T')[0] : '',
        profilePhoto: student?.profilePhoto || '',
        profilePhotoFileId: student?.profilePhotoFileId || '',
      });
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/students/profile', formData);
      await refreshProfile();
      toast.success('Profile updated successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size should be less than 10MB');
      return;
    }

    setUploading(true);
    const data = new FormData();
    data.append('file', file);

    try {
      const response = await api.post('/upload/file', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const { url, fileId } = response.data;
      
      setFormData(prev => ({ ...prev, profilePhoto: url, profilePhotoFileId: fileId }));
      
      // Auto-save the photo update
      await api.put('/students/profile', { ...formData, profilePhoto: url, profilePhotoFileId: fileId });
      await refreshProfile();
      toast.success('Profile photo updated!');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <DashboardLayout title="My Profile" isAdmin={false}>
        <div className="py-8"><InlineSkeletonList rows={5} /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="My Profile">
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-12">
        <Card className="bg-card border-border overflow-hidden shadow-sm">
          <div className="h-32 bg-gradient-to-r from-primary/40 to-primary/10 relative">
            <div className="absolute -bottom-12 left-6">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full border-4 border-background overflow-hidden bg-secondary flex items-center justify-center shadow-sm">
                  {formData.profilePhoto ? (
                    <img src={formData.profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-10 h-10 text-muted-foreground" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
                >
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin text-white" /> : <Camera className="w-6 h-6 text-white" />}
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                  accept="image/jpeg, image/png, image/webp"
                  className="hidden"
                />
              </div>
            </div>
          </div>
          
          <CardHeader className="pt-16 pb-4">
            <CardTitle className="text-2xl">{formData.name}</CardTitle>
            <CardDescription className="text-base flex items-center gap-2">
              @{formData.username}
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      id="email"
                      name="email"
                      value={formData.email}
                      className="pl-9 bg-secondary/50"
                      readOnly
                      disabled
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      id="username"
                      name="username"
                      value={formData.username}
                      className="pl-9 bg-secondary/50"
                      readOnly
                      disabled
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Mobile Number</Label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="parentPhone">Parent's Phone Number</Label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      id="parentPhone"
                      name="parentPhone"
                      value={formData.parentPhone}
                      onChange={handleChange}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dob">Date of Birth</Label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      id="dob"
                      name="dob"
                      type="date"
                      value={formData.dob}
                      onChange={handleChange}
                      className="pl-9"
                    />
                  </div>
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <div className="relative">
                    <Home className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      id="address"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={saving || uploading} className="px-8 shadow-sm">
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Clean Separate Logout Section */}
        <div className="flex justify-center mt-6">
          <Button 
            variant="ghost" 
            onClick={handleLogout}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive w-full sm:w-auto px-6 py-6 rounded-xl border border-destructive/20 shadow-sm transition-all active:scale-95"
          >
            <LogOut className="w-5 h-5 mr-2" />
            <span className="font-medium text-base">Logout securely</span>
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
