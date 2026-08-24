import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Plus,
  Search,
  ExternalLink,
  Ban,
  CheckCircle2,
  GitFork,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { superAdminService } from '@/services/api/superAdmin.service';
import { Organization } from '@/types';
import { toast } from 'react-toastify';

export default function OrganizationList() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    contactEmail: '',
    phone: '',
    address: '',
    city: '',
    state: '',
  });

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      setIsLoading(true);
      const res = await superAdminService.getOrganizations();
      if (res.success && res.data) {
        setOrganizations(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await superAdminService.createOrganization(formData);
      if (res.success) {
        toast.success(`Organization '${formData.name}' created successfully!`);
        setIsCreateOpen(false);
        setFormData({ name: '', slug: '', contactEmail: '', phone: '', address: '', city: '', state: '' });
        fetchOrganizations();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create organization');
    }
  };

  const handleToggleSuspend = async (org: Organization) => {
    const isSuspending = org.status !== 'SUSPENDED';
    try {
      const res = await superAdminService.suspendOrganization(org._id || org.id, isSuspending);
      if (res.success) {
        toast.success(`Organization ${isSuspending ? 'suspended' : 'activated'}`);
        fetchOrganizations();
      }
    } catch (error) {
      toast.error('Failed to update organization status');
    }
  };

  const filteredOrgs = organizations.filter(
    (o) =>
      o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.contactEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Organizations (Tenants)</h1>
          <p className="text-sm text-muted-foreground">Manage tenant companies, branches, subscriptions and isolation.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold">
          <Plus className="w-4 h-4 mr-2" />
          Onboard New Tenant
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
        <Input
          placeholder="Search by name, slug or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 bg-card"
        />
      </div>

      {/* Organizations Table Card */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-secondary/40 text-muted-foreground text-xs uppercase border-b border-border/50">
                <tr>
                  <th className="p-4">Organization</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Branches</th>
                  <th className="p-4">Students</th>
                  <th className="p-4">Contact</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredOrgs.map((org) => {
                  const orgId = org._id || org.id;
                  return (
                    <tr key={orgId} className="hover:bg-secondary/20 transition-colors">
                      <td className="p-4 font-medium text-foreground">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-bold text-amber-500">
                            {org.name.charAt(0)}
                          </div>
                          <div>
                            <span className="block font-semibold">{org.name}</span>
                            <span className="text-xs text-muted-foreground font-mono">/{org.slug}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge
                          variant="outline"
                          className={
                            org.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : org.status === 'TRIAL'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              : 'bg-destructive/10 text-destructive border-destructive/30'
                          }
                        >
                          {org.status}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
                          <GitFork className="w-3.5 h-3.5 text-blue-400" />
                          <span>{org.hostelCount ?? 1}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
                          <Users className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{org.studentCount ?? 0}</span>
                        </div>
                      </td>
                      <td className="p-4 text-xs text-muted-foreground">
                        <p>{org.contactEmail}</p>
                        <p>{org.phone || '--'}</p>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/super-admin/organizations/${orgId}`}>
                              <ExternalLink className="w-3.5 h-3.5 mr-1" />
                              Manage
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleSuspend(org)}
                            className={org.status === 'SUSPENDED' ? 'text-emerald-400' : 'text-destructive'}
                          >
                            {org.status === 'SUSPENDED' ? <CheckCircle2 className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Onboard Dialog Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Onboard New Organization</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Organization Name *</Label>
              <Input
                required
                placeholder="e.g., ABC Hostel Group"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Slug Identifier</Label>
                <Input
                  placeholder="e.g., abc-hostels"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Contact Email *</Label>
                <Input
                  type="email"
                  required
                  placeholder="admin@abchostels.com"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  placeholder="+91 9876543210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input
                  placeholder="Hyderabad"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-black font-semibold">
                Create Tenant
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
